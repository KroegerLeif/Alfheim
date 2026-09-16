package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
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

// HTTPClient talks to the Zitadel Management API through Caddy: Zitadel
// resolves the instance from the Host header rather than from the address it
// is dialled on, so every request is made against BaseURL (Caddy) while
// claiming Host as the external auth domain.
type HTTPClient struct {
	// BaseURL is where Caddy listens, e.g. http://127.0.0.1:80.
	BaseURL string
	// Host is the external auth domain Zitadel was configured with, e.g.
	// auth.alfheim.example.com.
	Host string
	// PAT is the bootstrap machine user's personal access token.
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
	return fmt.Sprintf("zitadel API %s %s returned HTTP %d: %s", e.method, e.path, e.status, e.body)
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

type idResponse struct {
	ID string `json:"id"`
}

type projectSearchResponse struct {
	Result []struct {
		ID string `json:"id"`
	} `json:"result"`
}

type appSearchResponse struct {
	Result []struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		OIDCConfig *struct {
			ClientID string `json:"clientId"`
		} `json:"oidcConfig"`
	} `json:"result"`
}

type createOIDCAppResponse struct {
	AppID        string `json:"appId"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

type generateSecretResponse struct {
	ClientSecret string `json:"clientSecret"`
}

// EnsureProject implements Client.
func (c *HTTPClient) EnsureProject(ctx context.Context, name string) (string, error) {
	searchBody := map[string]any{
		"queries": []map[string]any{
			{"nameQuery": map[string]any{"name": name, "method": "TEXT_QUERY_METHOD_EQUALS"}},
		},
	}
	respBody, err := c.request(ctx, http.MethodPost, "/management/v1/projects/_search", searchBody, "")
	if err != nil {
		return "", err
	}
	var search projectSearchResponse
	if err := json.Unmarshal(respBody, &search); err != nil {
		return "", fmt.Errorf("provisioning: decode project search response: %w", err)
	}
	if len(search.Result) > 0 && search.Result[0].ID != "" {
		return search.Result[0].ID, nil
	}

	createBody := map[string]any{"name": name}
	respBody, err = c.request(ctx, http.MethodPost, "/management/v1/projects", createBody, "")
	if err != nil {
		return "", err
	}
	var created idResponse
	if err := json.Unmarshal(respBody, &created); err != nil {
		return "", fmt.Errorf("provisioning: decode project create response: %w", err)
	}
	if created.ID == "" {
		return "", fmt.Errorf("provisioning: zitadel returned no project id for %q", name)
	}
	return created.ID, nil
}

// oidcConfigBody renders the shared parts of an OIDC application body: used
// both to create the app and to reconcile its redirect configuration.
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
		"appType":                appType,
		"authMethodType":         authMethod,
		"version":                "OIDC_VERSION_1_0",
		"devMode":                spec.DevMode,
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

// EnsureOIDCApp implements Client.
func (c *HTTPClient) EnsureOIDCApp(ctx context.Context, projectID string, spec AppSpec) (Credentials, error) {
	searchBody := map[string]any{
		"queries": []map[string]any{
			{"nameQuery": map[string]any{"name": spec.Name, "method": "TEXT_QUERY_METHOD_EQUALS"}},
		},
	}
	respBody, err := c.request(ctx,
		http.MethodPost, fmt.Sprintf("/management/v1/projects/%s/apps/_search", projectID), searchBody, "")
	if err != nil {
		return Credentials{}, err
	}
	var search appSearchResponse
	if err := json.Unmarshal(respBody, &search); err != nil {
		return Credentials{}, fmt.Errorf("provisioning: decode app search response: %w", err)
	}

	var appID, clientID string
	for _, a := range search.Result {
		if a.Name == spec.Name {
			appID = a.ID
			if a.OIDCConfig != nil {
				clientID = a.OIDCConfig.ClientID
			}
			break
		}
	}

	if appID == "" {
		createBody := map[string]any{"name": spec.Name}
		for k, v := range oidcConfigBody(spec) {
			createBody[k] = v
		}
		respBody, err = c.request(ctx,
			http.MethodPost, fmt.Sprintf("/management/v1/projects/%s/apps/oidc", projectID), createBody, "")
		if err != nil {
			return Credentials{}, err
		}
		var created createOIDCAppResponse
		if err := json.Unmarshal(respBody, &created); err != nil {
			return Credentials{}, fmt.Errorf("provisioning: decode app create response: %w", err)
		}
		if created.ClientID == "" {
			return Credentials{}, fmt.Errorf("provisioning: zitadel returned no clientId for %q", spec.Name)
		}
		return Credentials{ClientID: created.ClientID, ClientSecret: created.ClientSecret}, nil
	}

	// Reconcile the redirect configuration of an existing app. A no-op
	// update answers 400 COMMAND-1m88i ("No changes"), which is success here.
	_, err = c.request(ctx, http.MethodPut,
		fmt.Sprintf("/management/v1/projects/%s/apps/%s/oidc_config", projectID, appID),
		oidcConfigBody(spec), zitadelNoChangesError)
	if err != nil {
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

	respBody, err = c.request(ctx, http.MethodPost,
		fmt.Sprintf("/management/v1/projects/%s/apps/%s/oidc_config/_generate_client_secret", projectID, appID),
		map[string]any{}, "")
	if err != nil {
		return Credentials{}, err
	}
	var generated generateSecretResponse
	if err := json.Unmarshal(respBody, &generated); err != nil {
		return Credentials{}, fmt.Errorf("provisioning: decode secret regeneration response: %w", err)
	}
	if generated.ClientSecret == "" {
		return Credentials{}, fmt.Errorf("provisioning: zitadel returned no clientSecret regenerating %q", spec.Name)
	}
	return Credentials{ClientID: clientID, ClientSecret: generated.ClientSecret}, nil
}
