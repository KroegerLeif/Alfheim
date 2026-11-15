package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
)

const (
	// adminIDPSearchPath lists the instance's identity providers.
	adminIDPSearchPath = "/admin/v1/idps/templates/_search"
	// instanceLoginPolicyIDPsPath links providers to the instance login policy.
	instanceLoginPolicyIDPsPath = instanceLoginPolicyPath + "/idps"
	// orgLoginPolicyIDPsPath links providers to a custom organisation policy.
	orgLoginPolicyIDPsPath = orgLoginPolicyPath + "/idps"
)

// providerTemplate is one entry of the Admin API's provider search, reduced to
// the fields EnsureIDP compares. Secrets and keys are never returned.
type providerTemplate struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Config struct {
		Options idpOptions `json:"options"`
		Google  *struct {
			ClientID string   `json:"clientId"`
			Scopes   []string `json:"scopes"`
		} `json:"google"`
		Apple *struct {
			ClientID string   `json:"clientId"`
			TeamID   string   `json:"teamId"`
			KeyID    string   `json:"keyId"`
			Scopes   []string `json:"scopes"`
		} `json:"apple"`
	} `json:"config"`
}

// matches reports whether the readable part of p equals spec. The secret and
// the private key are compared through the fingerprint instead.
func (p providerTemplate) matches(spec IDPSpec) bool {
	if p.Config.Options != SocialLoginOptions {
		return false
	}
	if spec.Kind == IDPApple {
		a := p.Config.Apple
		return a != nil && a.ClientID == spec.ClientID && a.TeamID == spec.TeamID &&
			a.KeyID == spec.KeyID && slices.Equal(a.Scopes, spec.scopes())
	}
	g := p.Config.Google
	return g != nil && g.ClientID == spec.ClientID && slices.Equal(g.Scopes, spec.scopes())
}

// EnsureIDP implements Client.
//
// An enabled spec creates the provider, or updates it when its configuration
// or fingerprint differs, and then makes sure the login policy allows external
// login and lists the provider. A disabled spec only unlinks an existing
// provider from the login policy: deleting it would also delete every user's
// link to it, so re-enabling it later keeps existing accounts working.
func (c *HTTPClient) EnsureIDP(ctx context.Context, spec IDPSpec) (IDPOutcome, error) {
	existing, found, err := c.findProvider(ctx, spec)
	if err != nil {
		return IDPOutcome{}, err
	}
	if !spec.Enabled() {
		if !found {
			return IDPOutcome{Action: IDPAbsent}, nil
		}
		removed, err := c.unlinkProvider(ctx, existing.ID)
		if err != nil {
			return IDPOutcome{}, err
		}
		action := IDPAbsent
		if removed {
			action = IDPRemoved
		}
		return IDPOutcome{Action: action, ID: existing.ID}, nil
	}

	out := IDPOutcome{Action: IDPUnchanged, Fingerprint: spec.Fingerprint()}
	switch {
	case !found:
		out.ID, err = c.createProvider(ctx, spec)
		out.Action = IDPCreated
	case !existing.matches(spec) || spec.ExistingFingerprint != out.Fingerprint:
		out.ID = existing.ID
		out.Action = IDPUpdated
		_, err = c.request(ctx, http.MethodPut,
			fmt.Sprintf("/admin/v1/idps/%s/%s", spec.Kind, existing.ID), providerBody(spec), zitadelNoChangesError)
	default:
		out.ID = existing.ID
	}
	if err != nil {
		return IDPOutcome{}, err
	}
	if err := c.linkProvider(ctx, out.ID); err != nil {
		return IDPOutcome{}, err
	}
	return out, nil
}

// providerBody is the create and update request body for spec. Apple's
// private key is a protobuf bytes field, which encoding/json sends as the
// base64 the API expects.
func providerBody(spec IDPSpec) map[string]any {
	body := map[string]any{
		"name":            spec.Name(),
		"clientId":        spec.ClientID,
		"scopes":          spec.scopes(),
		"providerOptions": SocialLoginOptions,
	}
	if spec.Kind == IDPApple {
		body["teamId"] = spec.TeamID
		body["keyId"] = spec.KeyID
		body["privateKey"] = spec.PrivateKey
	} else {
		body["clientSecret"] = spec.ClientSecret
	}
	return body
}

// findProvider returns the instance provider named spec.Name() of spec's
// type, and whether there is one.
func (c *HTTPClient) findProvider(ctx context.Context, spec IDPSpec) (providerTemplate, bool, error) {
	body := map[string]any{"queries": []map[string]any{
		{"idpNameQuery": map[string]any{"name": spec.Name(), "method": "TEXT_QUERY_METHOD_EQUALS"}},
	}}
	respBody, err := c.request(ctx, http.MethodPost, adminIDPSearchPath, body, "")
	if err != nil {
		return providerTemplate{}, false, err
	}
	var search struct {
		Result []providerTemplate `json:"result"`
	}
	if err := json.Unmarshal(respBody, &search); err != nil {
		return providerTemplate{}, false, fmt.Errorf("provisioning: decode identity provider search response: %w", err)
	}
	for _, p := range search.Result {
		if p.Name == spec.Name() && p.Type == spec.zitadelType() {
			return p, true, nil
		}
	}
	return providerTemplate{}, false, nil
}

// createProvider creates spec's provider on the instance and returns its id.
func (c *HTTPClient) createProvider(ctx context.Context, spec IDPSpec) (string, error) {
	respBody, err := c.request(ctx, http.MethodPost, "/admin/v1/idps/"+string(spec.Kind), providerBody(spec), "")
	if err != nil {
		return "", err
	}
	var created idResponse
	if err := json.Unmarshal(respBody, &created); err != nil {
		return "", fmt.Errorf("provisioning: decode identity provider create response: %w", err)
	}
	if created.ID == "" {
		return "", fmt.Errorf("provisioning: zitadel returned no id for the %s provider", spec.Name())
	}
	return created.ID, nil
}

// linkProvider turns external login on and lists idpID on the instance login
// policy, and on the organisation's policy when that is a custom one (an
// inherited policy follows the instance, see EnsureRegistrationDisabled).
func (c *HTTPClient) linkProvider(ctx context.Context, idpID string) error {
	if _, err := c.setLoginPolicyFlags(ctx, instanceLoginPolicyPath, externalLoginOn); err != nil {
		return fmt.Errorf("instance login policy: %w", err)
	}
	if err := c.addPolicyLink(ctx, instanceLoginPolicyIDPsPath, map[string]any{"idpId": idpID}, idpID); err != nil {
		return fmt.Errorf("instance login policy: %w", err)
	}
	org, err := c.getLoginPolicy(ctx, orgLoginPolicyPath)
	if err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	if org.isDefault {
		return nil
	}
	if _, err := c.setLoginPolicyFlags(ctx, orgLoginPolicyPath, externalLoginOn); err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	body := map[string]any{"idpId": idpID, "ownerType": "IDP_OWNER_TYPE_SYSTEM"}
	if err := c.addPolicyLink(ctx, orgLoginPolicyIDPsPath, body, idpID); err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	return nil
}

// unlinkProvider removes idpID from the instance policy and a custom
// organisation policy. It reports whether any link was removed.
func (c *HTTPClient) unlinkProvider(ctx context.Context, idpID string) (bool, error) {
	paths := []string{instanceLoginPolicyIDPsPath}
	org, err := c.getLoginPolicy(ctx, orgLoginPolicyPath)
	if err != nil {
		return false, fmt.Errorf("organisation login policy: %w", err)
	}
	if !org.isDefault {
		paths = append(paths, orgLoginPolicyIDPsPath)
	}
	removed := false
	for _, path := range paths {
		linked, err := c.policyLinked(ctx, path, idpID)
		if err != nil {
			return false, err
		}
		if !linked {
			continue
		}
		if _, err := c.request(ctx, http.MethodDelete, path+"/"+idpID, nil, ""); err != nil {
			return false, err
		}
		removed = true
	}
	return removed, nil
}

// addPolicyLink links idpID through the policy endpoint at path unless it
// is already linked.
func (c *HTTPClient) addPolicyLink(ctx context.Context, path string, body map[string]any, idpID string) error {
	linked, err := c.policyLinked(ctx, path, idpID)
	if err != nil || linked {
		return err
	}
	_, err = c.request(ctx, http.MethodPost, path, body, "")
	return err
}

// policyLinked reports whether the login policy behind path lists idpID.
func (c *HTTPClient) policyLinked(ctx context.Context, path, idpID string) (bool, error) {
	respBody, err := c.request(ctx, http.MethodPost, path+"/_search", map[string]any{}, "")
	if err != nil {
		return false, err
	}
	var search struct {
		Result []policyIDPLink `json:"result"`
	}
	if err := json.Unmarshal(respBody, &search); err != nil {
		return false, fmt.Errorf("provisioning: decode login policy provider list from %s: %w", path, err)
	}
	return slices.ContainsFunc(search.Result, func(l policyIDPLink) bool { return l.IDPID == idpID }), nil
}

// policyIDPLink is one provider listed on a login policy.
type policyIDPLink struct {
	IDPID string `json:"idpId"`
}
