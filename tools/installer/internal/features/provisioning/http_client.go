package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Clock abstracts time for the retry backoff, so tests do not have to wait in
// real time. It mirrors the pattern used by bootstrap/wait.go.
type Clock interface {
	Sleep(ctx context.Context, d time.Duration) error
}

// realClock is the production clock.
type realClock struct{}

// Sleep waits for d, or returns early when ctx is cancelled.
func (realClock) Sleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// HTTPClient talks to the Zitadel APIs (v2 services, see zitadel_v2.go) through Caddy: Zitadel
// resolves the instance from the Host header rather than from the address it
// is dialled on, so every request is made against BaseURL (Caddy) while
// claiming Host as the external auth domain.
type HTTPClient struct {
	// BaseURL is where Caddy listens, e.g. http://127.0.0.1:80.
	BaseURL string
	// Host is the external auth domain Zitadel was configured with, e.g.
	// auth.alfheim.example.com.
	Host string
	// PAT is the bearer token every request carries. Despite the name it is
	// normally a short-lived access token from the provisioning machine key
	// (see WithToken and internal/features/zitadelauth); only the first run
	// of an install uses Zitadel's bootstrap personal access token here.
	PAT string

	// HTTP is the transport. Defaults to http.DefaultClient.
	HTTP *http.Client
	// Clock drives the retry backoff. Defaults to a real clock.
	Clock Clock
	// MaxRetries bounds the number of retry attempts on a transient error.
	// Defaults to 5.
	MaxRetries int
	// BaseDelay is the first retry delay; each subsequent attempt doubles it.
	// Defaults to 500ms.
	BaseDelay time.Duration
}

func (c *HTTPClient) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

func (c *HTTPClient) clock() Clock {
	if c.Clock != nil {
		return c.Clock
	}
	return realClock{}
}

func (c *HTTPClient) maxRetries() int {
	if c.MaxRetries > 0 {
		return c.MaxRetries
	}
	return 5
}

func (c *HTTPClient) baseDelay() time.Duration {
	if c.BaseDelay > 0 {
		return c.BaseDelay
	}
	return 500 * time.Millisecond
}

// apiError is returned by request when Zitadel answers with a non-2xx status
// that the caller did not ask to tolerate.
type apiError struct {
	method, path string
	status       int
	body         string
}

func (e *apiError) Error() string {
	msg := fmt.Sprintf("zitadel API %s %s returned HTTP %d: %s", e.method, e.path, e.status, e.body)
	if e.status >= 300 && e.status < 400 {
		// Redirects are never followed (see Endpoint): the usual cause is a
		// plain-HTTP request against an install Caddy serves over HTTPS.
		msg += " (redirect not followed: check that ZITADEL_EXTERNALSECURE in .env matches how Caddy serves the auth host)"
	}
	return msg
}

// Status is the HTTP status Zitadel answered with.
func (e *apiError) Status() int { return e.status }

// IsUnauthorized reports whether err is (or wraps) a Zitadel API error with
// status 401 or 403 — the bearer PAT was rejected outright, as opposed to a
// transient or a request-shape problem. The caller uses this to give a more
// actionable message than the raw HTTP error, since the overwhelmingly
// common cause is a stale PAT left over from an earlier install.
func IsUnauthorized(err error) bool {
	var apiErr *apiError
	if !errors.As(err, &apiErr) {
		return false
	}
	return apiErr.status == http.StatusUnauthorized || apiErr.status == http.StatusForbidden
}

// request performs one Management API call, retrying transient failures
// (connection refused, 5xx) with a bounded exponential backoff — Zitadel can
// answer those for a few seconds right after its healthcheck turns green.
// tolerateSubstr, when non-empty, makes a non-2xx response whose body
// contains it a success, matching the "no changes" idempotent-update case.
func (c *HTTPClient) request(
	ctx context.Context, method, path string, body any, tolerateSubstr string,
) ([]byte, error) {
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("provisioning: marshal request body for %s %s: %w", method, path, err)
		}
	}

	var lastErr error
	delay := c.baseDelay()
	for attempt := 0; attempt <= c.maxRetries(); attempt++ {
		if attempt > 0 {
			if err := c.clock().Sleep(ctx, delay); err != nil {
				return nil, err
			}
			delay *= 2
		}

		respBody, status, err := c.doOnce(ctx, method, path, payload)
		if err != nil {
			lastErr = fmt.Errorf("provisioning: %s %s: %w", method, path, err)
			continue // network-level failure: always transient, retry.
		}
		if status >= 200 && status < 300 {
			return respBody, nil
		}
		if tolerateSubstr != "" && strings.Contains(string(respBody), tolerateSubstr) {
			return respBody, nil
		}
		apiErr := &apiError{method: method, path: path, status: status, body: string(respBody)}
		if status >= 500 {
			lastErr = apiErr
			continue // server-side failure: retry.
		}
		return nil, apiErr // 4xx is not transient; fail immediately.
	}
	return nil, fmt.Errorf("provisioning: %s %s failed after %d attempts: %w",
		method, path, c.maxRetries()+1, lastErr)
}

func (c *HTTPClient) doOnce(ctx context.Context, method, path string, payload []byte) ([]byte, int, error) {
	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return nil, 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Host", c.Host)
	req.Host = c.Host
	req.Header.Set("Authorization", "Bearer "+c.PAT)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read response body: %w", err)
	}
	return respBody, resp.StatusCode, nil
}

// --- Client implementation ---------------------------------------------

// idResponse decodes the id the v1 Admin API returns for a created object
// (identity and e-mail providers).
type idResponse struct {
	ID string `json:"id"`
}

// zitadelApplication is the subset of a v2 application the installer reads.
type zitadelApplication struct {
	ID         string `json:"applicationId"`
	Name       string `json:"name"`
	OIDCConfig *struct {
		ClientID string `json:"clientId"`
	} `json:"oidcConfiguration"`
}

// EnsureProject implements Client.
func (c *HTTPClient) EnsureProject(ctx context.Context, name string) (string, error) {
	orgID, err := c.currentUserOrganization(ctx)
	if err != nil {
		return "", err
	}
	listBody := map[string]any{
		"filters": []map[string]any{
			{"organizationIdFilter": map[string]any{"organizationId": orgID}},
			{"projectNameFilter": map[string]any{"projectName": name, "method": "TEXT_FILTER_METHOD_EQUALS"}},
		},
	}
	var list struct {
		Projects []zitadelProject `json:"projects"`
	}
	if err := c.call(ctx, projectService, "ListProjects", listBody, &list, ""); err != nil {
		return "", err
	}
	for _, p := range list.Projects {
		if p.Name == name && p.ID != "" {
			return p.ID, nil
		}
	}

	var created struct {
		ProjectID string `json:"projectId"`
	}
	createBody := map[string]any{"organizationId": orgID, "name": name}
	if err := c.call(ctx, projectService, "CreateProject", createBody, &created, ""); err != nil {
		return "", err
	}
	if created.ProjectID == "" {
		return "", fmt.Errorf("provisioning: zitadel returned no project id for %q", name)
	}
	return created.ProjectID, nil
}

// oidcConfigBody renders the OIDC configuration of an application: used both
// to create the app and to reconcile its redirect configuration.
func oidcConfigBody(spec AppSpec) map[string]any {
	appType := "OIDC_APP_TYPE_WEB"
	authMethod := "OIDC_AUTH_METHOD_TYPE_BASIC"
	if spec.Type == AppTypePublicPKCE {
		appType = "OIDC_APP_TYPE_USER_AGENT"
		authMethod = "OIDC_AUTH_METHOD_TYPE_NONE"
	}
	return map[string]any{
		"redirectUris":           spec.RedirectURIs,
		"postLogoutRedirectUris": spec.PostLogoutRedirectURIs,
		"responseTypes":          []string{"OIDC_RESPONSE_TYPE_CODE"},
		"grantTypes":             []string{"OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN"},
		"applicationType":        appType,
		"authMethodType":         authMethod,
		"version":                "OIDC_VERSION_1_0",
		"developmentMode":        spec.DevMode,
		// Backends validate the access token themselves (JWKS from
		// OIDC_ISSUER_URL), which needs a JWT, not Zitadel's default opaque
		// bearer token.
		"accessTokenType":          "OIDC_TOKEN_TYPE_JWT",
		"accessTokenRoleAssertion": true,
		"idTokenRoleAssertion":     true,
		"idTokenUserinfoAssertion": true,
		"clockSkew":                "1s",
	}
}

// zitadelNoChangesError is the id Zitadel answers with when an update would
// not change anything, which a reconciling client treats as success.
const zitadelNoChangesError = "COMMAND-1m88i"

// findApplication returns the application named name inside projectID, or a
// zero value when there is none.
func (c *HTTPClient) findApplication(ctx context.Context, projectID, name string) (zitadelApplication, error) {
	listBody := map[string]any{
		"filters": []map[string]any{
			{"projectIdFilter": map[string]any{"projectId": projectID}},
			{"nameFilter": map[string]any{"name": name, "method": "TEXT_FILTER_METHOD_EQUALS"}},
		},
	}
	var list struct {
		Applications []zitadelApplication `json:"applications"`
	}
	if err := c.call(ctx, applicationService, "ListApplications", listBody, &list, ""); err != nil {
		return zitadelApplication{}, err
	}
	for _, a := range list.Applications {
		if a.Name == name {
			return a, nil
		}
	}
	return zitadelApplication{}, nil
}

// EnsureOIDCApp implements Client.
func (c *HTTPClient) EnsureOIDCApp(ctx context.Context, projectID string, spec AppSpec) (Credentials, error) {
	app, err := c.findApplication(ctx, projectID, spec.Name)
	if err != nil {
		return Credentials{}, err
	}

	if app.ID == "" {
		createBody := map[string]any{
			"projectId":         projectID,
			"name":              spec.Name,
			"oidcConfiguration": oidcConfigBody(spec),
		}
		var created struct {
			OIDCConfig struct {
				ClientID     string `json:"clientId"`
				ClientSecret string `json:"clientSecret"`
			} `json:"oidcConfiguration"`
		}
		if err := c.call(ctx, applicationService, "CreateApplication", createBody, &created, ""); err != nil {
			return Credentials{}, err
		}
		if created.OIDCConfig.ClientID == "" {
			return Credentials{}, fmt.Errorf("provisioning: zitadel returned no clientId for %q", spec.Name)
		}
		return Credentials{ClientID: created.OIDCConfig.ClientID, ClientSecret: created.OIDCConfig.ClientSecret}, nil
	}

	var clientID string
	if app.OIDCConfig != nil {
		clientID = app.OIDCConfig.ClientID
	}

	// Reconcile the redirect configuration of an existing app. A no-op
	// update answers 400 COMMAND-1m88i ("No changes"), which is success here.
	updateBody := map[string]any{
		"projectId":         projectID,
		"applicationId":     app.ID,
		"oidcConfiguration": oidcConfigBody(spec),
	}
	if err := c.call(ctx, applicationService, "UpdateApplication", updateBody, nil, zitadelNoChangesError); err != nil {
		return Credentials{}, err
	}

	if spec.Type == AppTypePublicPKCE {
		// A public client has no secret to manage.
		return Credentials{ClientID: clientID}, nil
	}

	needsRegenerate := spec.ExistingClientSecret == "" || spec.ExistingClientID != clientID
	if !needsRegenerate {
		return Credentials{ClientID: clientID, ClientSecret: spec.ExistingClientSecret}, nil
	}

	var generated struct {
		ClientSecret string `json:"clientSecret"`
	}
	secretBody := map[string]any{"projectId": projectID, "applicationId": app.ID}
	if err := c.call(ctx, applicationService, "GenerateClientSecret", secretBody, &generated, ""); err != nil {
		return Credentials{}, err
	}
	if generated.ClientSecret == "" {
		return Credentials{}, fmt.Errorf("provisioning: zitadel returned no clientSecret regenerating %q", spec.Name)
	}
	return Credentials{ClientID: clientID, ClientSecret: generated.ClientSecret}, nil
}

// loginPolicyFields are the settings the Zitadel login policy update
// endpoints accept. A PUT replaces the whole policy (an omitted field falls
// back to its zero value), so EnsureRegistrationDisabled copies exactly
// these from the current policy and changes only allowRegister. Read-only
// fields such as isDefault and details are deliberately not sent back.
var loginPolicyFields = []string{
	"allowUsernamePassword", "allowRegister", "allowExternalIdp", "forceMfa",
	"passwordlessType", "hidePasswordReset", "ignoreUnknownUsernames",
	"defaultRedirectUri", "passwordCheckLifetime", "externalLoginCheckLifetime",
	"mfaInitSkipLifetime", "secondFactorCheckLifetime", "multiFactorCheckLifetime",
	"allowDomainDiscovery", "disableLoginWithEmail", "disableLoginWithPhone",
	"forceMfaLocalOnly",
}

const (
	// instanceLoginPolicyPath is the Admin API login policy every
	// organisation without its own custom policy inherits. Login policies stay
	// on v1: Zitadel 4's settings.v2 service only reads them (see zitadel_v2.go).
	instanceLoginPolicyPath = "/admin/v1/policies/login"
	// orgLoginPolicyPath is the Management API login policy of the
	// organisation the bootstrap PAT belongs to, which is where the
	// installation's users live.
	orgLoginPolicyPath = "/management/v1/policies/login"
)

// loginPolicy is one decoded login policy response.
type loginPolicy struct {
	fields    map[string]any
	isDefault bool
}

func (p loginPolicy) allowRegister() bool {
	v, _ := p.fields["allowRegister"].(bool)
	return v
}

// hasFlags reports whether every flag in want already has the wanted value.
// An omitted boolean field is false, as Zitadel's JSON omits false values.
func (p loginPolicy) hasFlags(want map[string]bool) bool {
	for key, v := range want {
		got, _ := p.fields[key].(bool)
		if got != v {
			return false
		}
	}
	return true
}

func (c *HTTPClient) getLoginPolicy(ctx context.Context, path string) (loginPolicy, error) {
	respBody, err := c.request(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return loginPolicy{}, err
	}
	var decoded struct {
		Policy map[string]any `json:"policy"`
	}
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return loginPolicy{}, fmt.Errorf("provisioning: decode login policy response from %s: %w", path, err)
	}
	if decoded.Policy == nil {
		return loginPolicy{}, fmt.Errorf("provisioning: %s returned no login policy", path)
	}
	isDefault, _ := decoded.Policy["isDefault"].(bool)
	return loginPolicy{fields: decoded.Policy, isDefault: isDefault}, nil
}

// setLoginPolicyFlags reads the policy at path and, unless every flag in want
// already has the wanted value, writes it back with those flags changed and
// every other setting unchanged. It returns the policy as read before the
// change.
func (c *HTTPClient) setLoginPolicyFlags(ctx context.Context, path string, want map[string]bool) (loginPolicy, error) {
	current, err := c.getLoginPolicy(ctx, path)
	if err != nil {
		return loginPolicy{}, err
	}
	if current.hasFlags(want) {
		return current, nil
	}
	body := make(map[string]any, len(loginPolicyFields))
	for _, key := range loginPolicyFields {
		if v, ok := current.fields[key]; ok {
			body[key] = v
		}
	}
	for key, v := range want {
		body[key] = v
	}
	if _, err := c.request(ctx, http.MethodPut, path, body, ""); err != nil {
		return loginPolicy{}, err
	}
	return current, nil
}

// registrationOff is the login policy change EnsureRegistrationDisabled makes.
var registrationOff = map[string]bool{"allowRegister": false}

// EnsureRegistrationDisabled implements Client.
//
// Two policies can show a "Register" link on the login page: the instance
// default (Admin API), which Zitadel ships with allowRegister=true, and a
// custom policy on the organisation (Management API) if one was ever set,
// which overrides the default. The instance default is always corrected; the
// organisation policy is corrected only when it is a custom one, because
// writing to an inherited one would turn it into a custom copy that stops
// following the instance. Both are read back afterwards, because a policy
// that silently stayed open must fail the install, not pass it.
func (c *HTTPClient) EnsureRegistrationDisabled(ctx context.Context) error {
	if _, err := c.setLoginPolicyFlags(ctx, instanceLoginPolicyPath, registrationOff); err != nil {
		return fmt.Errorf("instance login policy: %w", err)
	}

	org, err := c.getLoginPolicy(ctx, orgLoginPolicyPath)
	if err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	if !org.isDefault {
		if _, err := c.setLoginPolicyFlags(ctx, orgLoginPolicyPath, registrationOff); err != nil {
			return fmt.Errorf("organisation login policy: %w", err)
		}
	}

	instance, err := c.getLoginPolicy(ctx, instanceLoginPolicyPath)
	if err != nil {
		return fmt.Errorf("verify instance login policy: %w", err)
	}
	if instance.allowRegister() {
		return errors.New("verify instance login policy: allowRegister is still true after the update")
	}
	effective, err := c.getLoginPolicy(ctx, orgLoginPolicyPath)
	if err != nil {
		return fmt.Errorf("verify organisation login policy: %w", err)
	}
	if effective.allowRegister() {
		return errors.New("verify organisation login policy: allowRegister is still true after the update")
	}
	return nil
}
