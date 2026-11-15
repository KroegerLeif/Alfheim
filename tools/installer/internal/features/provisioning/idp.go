package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// IDPKind selects which external identity provider an IDPSpec configures.
type IDPKind string

const (
	// IDPGoogle is "Sign in with Google" (an OAuth client from Google Cloud).
	IDPGoogle IDPKind = "google"
	// IDPApple is "Sign in with Apple" (a Services ID plus a .p8 signing key).
	IDPApple IDPKind = "apple"
)

// IDPSpec declares one social login provider EnsureIDP reconciles. A spec
// without a ClientID means the provider is switched off: an existing one is
// taken off the login page, never created.
type IDPSpec struct {
	Kind IDPKind
	// ClientID is the Google OAuth client id or the Apple Services ID.
	ClientID string
	// ClientSecret is Google's client secret. It is sent to Zitadel only and
	// never logged.
	ClientSecret string
	// TeamID, KeyID and PrivateKey (the .p8 file's PEM content) are Apple's.
	// Zitadel stores the key encrypted and mints Apple's client secret JWT
	// from it on every login; the installer only uploads it.
	TeamID     string
	KeyID      string
	PrivateKey []byte
	// ExistingFingerprint is the Fingerprint recorded by the previous run. The
	// secret and key cannot be read back from Zitadel, so a matching
	// fingerprint is what proves they did not change.
	ExistingFingerprint string
}

// Enabled reports whether the operator configured this provider.
func (s IDPSpec) Enabled() bool { return s.ClientID != "" }

// Name is the provider's display name in Zitadel, shown on the login button
// and used to find it again on the next run.
func (s IDPSpec) Name() string {
	if s.Kind == IDPApple {
		return "Apple"
	}
	return "Google"
}

// Fingerprint is a SHA-256 over every configured value, including the secret
// and the key. Recording it in .env lets the next run detect a rotated
// credential without keeping a second copy of it. It is empty when the
// provider is disabled.
func (s IDPSpec) Fingerprint() string {
	if !s.Enabled() {
		return ""
	}
	h := sha256.New()
	for _, part := range [][]byte{
		[]byte(s.Kind), []byte(s.ClientID), []byte(s.ClientSecret),
		[]byte(s.TeamID), []byte(s.KeyID), s.PrivateKey,
	} {
		// The length prefix keeps ("ab", "c") and ("a", "bc") apart.
		_, _ = fmt.Fprintf(h, "%d:", len(part))
		_, _ = h.Write(part)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// scopes are the provider scopes Zitadel requests. Apple rejects "profile";
// Zitadel adds "openid" to Apple's on its own.
func (s IDPSpec) scopes() []string {
	if s.Kind == IDPApple {
		return []string{"name", "email"}
	}
	return []string{"openid", "profile", "email"}
}

// zitadelType is the Admin API's provider type for s.Kind.
func (s IDPSpec) zitadelType() string {
	if s.Kind == IDPApple {
		return "PROVIDER_TYPE_APPLE"
	}
	return "PROVIDER_TYPE_GOOGLE"
}

// FingerprintEnvKey is the .env variable that records the fingerprint of the
// provider kind's last provisioned configuration.
func FingerprintEnvKey(kind IDPKind) string {
	return "ZITADEL_" + strings.ToUpper(string(kind)) + "_IDP_FINGERPRINT"
}

// SocialLoginOptions are the Zitadel IdP options ADR 0008 prescribes: create
// a first-time user just in time, keep the profile in sync, and link to an
// existing user only by an e-mail verified on both sides.
var SocialLoginOptions = idpOptions{
	IsLinkingAllowed:  true,
	IsCreationAllowed: true,
	IsAutoCreation:    true,
	IsAutoUpdate:      true,
	AutoLinking:       "AUTO_LINKING_OPTION_EMAIL",
}

// idpOptions is Zitadel's idp.v1.Options in its JSON form.
type idpOptions struct {
	IsLinkingAllowed  bool   `json:"isLinkingAllowed"`
	IsCreationAllowed bool   `json:"isCreationAllowed"`
	IsAutoCreation    bool   `json:"isAutoCreation"`
	IsAutoUpdate      bool   `json:"isAutoUpdate"`
	AutoLinking       string `json:"autoLinking"`
}

// externalLoginOn is the login policy change a configured provider needs.
// allowExternalIdp makes Zitadel show and accept external providers.
// allowRegister is written as false again on purpose: it only governs local
// username/password registration, and JIT creation does not need it (Zitadel
// v4.20.3: register_handler.go lines 70-84 are its only reader, while
// external_provider_handler.go createOrLinkUser, line 668, creates the user
// through AutoRegisterExternalUser without checking it). See ADR 0008.
var externalLoginOn = map[string]bool{"allowExternalIdp": true, "allowRegister": false}

// IDPAction is what EnsureIDP did.
type IDPAction string

const (
	// IDPCreated means the provider did not exist and was created.
	IDPCreated IDPAction = "created"
	// IDPUpdated means an existing provider's configuration was changed.
	IDPUpdated IDPAction = "updated"
	// IDPUnchanged means the provider already matched the spec.
	IDPUnchanged IDPAction = "unchanged"
	// IDPRemoved means a disabled provider was taken off the login policy.
	IDPRemoved IDPAction = "removed"
	// IDPAbsent means a disabled provider was not on the login page anyway.
	IDPAbsent IDPAction = "absent"
)

// IDPOutcome reports one reconciled provider.
type IDPOutcome struct {
	Kind   IDPKind
	Action IDPAction
	// ID is Zitadel's provider id; empty when none exists.
	ID string
	// Fingerprint is what to record in .env for the next run.
	Fingerprint string
	// RedirectURI is the callback the operator registers at the provider.
	// It is set only for an enabled provider.
	RedirectURI string
}

// CallbackURL is the Zitadel Login V1 callback the provider redirects to,
// on the public auth origin (for example https://auth.example.com). Google
// redirects with GET; Apple answers with a form POST (response_mode
// form_post) to its own endpoint, which Zitadel turns into a GET redirect
// (Zitadel v4.20.3, internal/api/ui/login/router.go lines 17-18).
func CallbackURL(authOrigin string, kind IDPKind) string {
	base := strings.TrimSuffix(authOrigin, "/") + "/ui/login/login/externalidp/callback"
	if kind == IDPApple {
		return base + "/form"
	}
	return base
}

// ensureIDPs reconciles every spec and returns the outcomes in input order.
// A disabled provider that no earlier run recorded a fingerprint for was
// never provisioned, so it is skipped without an API call and without an
// outcome: an installation that never uses social login stays untouched.
func ensureIDPs(ctx context.Context, c Client, authOrigin string, specs []IDPSpec) ([]IDPOutcome, error) {
	outcomes := make([]IDPOutcome, 0, len(specs))
	for _, spec := range specs {
		if !spec.Enabled() && spec.ExistingFingerprint == "" {
			continue
		}
		out, err := c.EnsureIDP(ctx, spec)
		if err != nil {
			return outcomes, fmt.Errorf("%s sign-in: %w", spec.Name(), err)
		}
		out.Kind = spec.Kind
		if spec.Enabled() {
			out.RedirectURI = CallbackURL(authOrigin, spec.Kind)
		}
		outcomes = append(outcomes, out)
	}
	return outcomes, nil
}
