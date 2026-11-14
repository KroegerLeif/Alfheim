package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	// adminEmailProvidersSearchPath lists the instance's e-mail providers
	// (Admin API ListEmailProviders, Zitadel v2.59 and later).
	adminEmailProvidersSearchPath = "/admin/v1/email/_search"
	// adminEmailSMTPPath creates (POST) or, with "/{id}", updates (PUT) an
	// SMTP e-mail provider.
	adminEmailSMTPPath = "/admin/v1/email/smtp"
	// adminEmailPath addresses one provider: DELETE "/{id}" removes it and
	// POST "/{id}/_activate" makes it the instance's active one.
	adminEmailPath = "/admin/v1/email"
	// emailProviderActive is the state of the provider Zitadel sends with.
	emailProviderActive = "EMAIL_PROVIDER_ACTIVE"
	// zitadelSMTPAlreadyActive is the error id of activating a provider that
	// already is active, which only a concurrent run can cause.
	zitadelSMTPAlreadyActive = "COMMAND-vUHBSmBzaw"
)

// emailProvider is one entry of the Admin API's e-mail provider list,
// reduced to the fields EnsureSMTP compares. The password is never returned.
type emailProvider struct {
	ID          string `json:"id"`
	State       string `json:"state"`
	Description string `json:"description"`
	SMTP        *struct {
		SenderAddress string    `json:"senderAddress"`
		SenderName    string    `json:"senderName"`
		TLS           bool      `json:"tls"`
		Host          string    `json:"host"`
		User          string    `json:"user"`
		Plain         *struct{} `json:"plain"`
	} `json:"smtp"`
}

// matches reports whether the readable part of p equals spec. The password
// is compared through the fingerprint instead.
func (p emailProvider) matches(spec SMTPSpec) bool {
	s := p.SMTP
	return s != nil && s.Host == spec.HostPort() && s.SenderAddress == spec.SenderAddress &&
		s.SenderName == spec.SenderName && s.TLS == spec.TLS && s.User == spec.User &&
		(s.Plain != nil) == (spec.User != "")
}

// EnsureSMTP implements Client.
//
// An enabled spec creates the installer's SMTP provider, or updates it when
// its configuration or fingerprint differs, and activates it. A disabled
// spec removes the installer's provider, which also discards the stored
// password. Providers an operator added in the console are never changed.
//
// The login page's "Forgot password" link follows: it is hidden while no
// e-mail provider is active, because the reset code could never arrive,
// and shown again when the installer turns e-mail on.
func (c *HTTPClient) EnsureSMTP(ctx context.Context, spec SMTPSpec) (SMTPOutcome, error) {
	providers, err := c.listEmailProviders(ctx)
	if err != nil {
		return SMTPOutcome{}, err
	}
	var ours *emailProvider
	for i := range providers {
		if providers[i].Description == SMTPProviderDescription && providers[i].SMTP != nil {
			ours = &providers[i]
			break
		}
	}

	if spec.Enabled() {
		out, err := c.reconcileSMTP(ctx, spec, ours)
		if err != nil {
			return SMTPOutcome{}, err
		}
		// Only on the switch from off to on: afterwards the operator may hide
		// the link on purpose and a re-run must not undo that.
		if spec.ExistingFingerprint == "" {
			if err := c.setPasswordResetHidden(ctx, false); err != nil {
				return SMTPOutcome{}, err
			}
		}
		return out, nil
	}

	out := SMTPOutcome{Action: SMTPAbsent}
	if ours != nil {
		if _, err := c.request(ctx, http.MethodDelete, adminEmailPath+"/"+ours.ID, nil, ""); err != nil {
			return SMTPOutcome{}, err
		}
		out = SMTPOutcome{Action: SMTPRemoved, ID: ours.ID}
	}
	for _, p := range providers {
		if p.State == emailProviderActive && (ours == nil || p.ID != ours.ID) {
			out.ExternalProvider = true
		}
	}
	if !out.ExternalProvider {
		if err := c.setPasswordResetHidden(ctx, true); err != nil {
			return SMTPOutcome{}, err
		}
		out.PasswordResetHidden = true
	}
	return out, nil
}

// reconcileSMTP creates or updates the installer's provider and makes sure
// it is the active one.
func (c *HTTPClient) reconcileSMTP(ctx context.Context, spec SMTPSpec, ours *emailProvider) (SMTPOutcome, error) {
	out := SMTPOutcome{Action: SMTPUnchanged, Fingerprint: spec.Fingerprint()}
	active := false
	switch {
	case ours == nil:
		respBody, err := c.request(ctx, http.MethodPost, adminEmailSMTPPath, smtpBody(spec), "")
		if err != nil {
			return SMTPOutcome{}, err
		}
		var created idResponse
		if err := json.Unmarshal(respBody, &created); err != nil {
			return SMTPOutcome{}, fmt.Errorf("provisioning: decode SMTP provider create response: %w", err)
		}
		if created.ID == "" {
			return SMTPOutcome{}, fmt.Errorf("provisioning: zitadel returned no id for the SMTP provider")
		}
		out.ID, out.Action = created.ID, SMTPCreated
	case !ours.matches(spec) || spec.ExistingFingerprint != out.Fingerprint:
		out.ID, out.Action, active = ours.ID, SMTPUpdated, ours.State == emailProviderActive
		if _, err := c.request(ctx, http.MethodPut, adminEmailSMTPPath+"/"+ours.ID, smtpBody(spec), ""); err != nil {
			return SMTPOutcome{}, err
		}
	default:
		out.ID, active = ours.ID, ours.State == emailProviderActive
	}
	if !active {
		path := adminEmailPath + "/" + out.ID + "/_activate"
		if _, err := c.request(ctx, http.MethodPost, path, map[string]any{}, zitadelSMTPAlreadyActive); err != nil {
			return SMTPOutcome{}, err
		}
		if out.Action == SMTPUnchanged {
			out.Action = SMTPUpdated
		}
	}
	return out, nil
}

// smtpBody is the create and update request body for spec. PLAIN auth is
// used with a user, no auth for an open relay; the deprecated top-level
// password field is left out.
func smtpBody(spec SMTPSpec) map[string]any {
	body := map[string]any{
		"senderAddress": spec.SenderAddress,
		"senderName":    spec.SenderName,
		"tls":           spec.TLS,
		"host":          spec.HostPort(),
		"user":          spec.User,
		"description":   SMTPProviderDescription,
	}
	if spec.User != "" {
		body["plain"] = map[string]any{"password": spec.Password}
	} else {
		body["none"] = map[string]any{}
	}
	return body
}

// listEmailProviders returns every e-mail provider of the instance.
func (c *HTTPClient) listEmailProviders(ctx context.Context) ([]emailProvider, error) {
	respBody, err := c.request(ctx, http.MethodPost, adminEmailProvidersSearchPath, map[string]any{}, "")
	if err != nil {
		return nil, err
	}
	var list struct {
		Result []emailProvider `json:"result"`
	}
	if err := json.Unmarshal(respBody, &list); err != nil {
		return nil, fmt.Errorf("provisioning: decode e-mail provider list: %w", err)
	}
	return list.Result, nil
}

// setPasswordResetHidden sets hidePasswordReset on the instance login policy
// and on the organisation's policy when that is a custom one, for the same
// reason EnsureRegistrationDisabled treats them that way.
func (c *HTTPClient) setPasswordResetHidden(ctx context.Context, hidden bool) error {
	want := map[string]bool{"hidePasswordReset": hidden}
	if _, err := c.setLoginPolicyFlags(ctx, instanceLoginPolicyPath, want); err != nil {
		return fmt.Errorf("instance login policy: %w", err)
	}
	org, err := c.getLoginPolicy(ctx, orgLoginPolicyPath)
	if err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	if org.isDefault {
		return nil
	}
	if _, err := c.setLoginPolicyFlags(ctx, orgLoginPolicyPath, want); err != nil {
		return fmt.Errorf("organisation login policy: %w", err)
	}
	return nil
}
