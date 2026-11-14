package app

import (
	"fmt"
	"io"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/security"
	"alfheim/installer/internal/features/sociallogin"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// SocialLoginAsker is implemented by wizards that can also run the optional
// "external sign-in" step. The headless path and test doubles do not need to.
type SocialLoginAsker interface {
	AskSocialLogin(s *sociallogin.Settings) error
}

// configureSocialLogin resolves the social login settings: flags and the
// environment first, then what an earlier run left in .env, and in the
// interactive wizard whatever the operator answers (pre-filled with those).
// The wizard step is skipped when a flag or variable already answered it.
func (a *App) configureSocialLogin(layout paths.Layout) (sociallogin.Settings, error) {
	chosen := a.Options.SocialLogin
	explicit := chosen.Explicit()

	if previous, err := envfile.ParseFile(layout.EnvFile()); err == nil {
		chosen = chosen.Merge(sociallogin.FromEnv(previous))
	}

	if !a.Options.NonInteractive && !explicit {
		if asker, ok := a.Wizard.(SocialLoginAsker); ok {
			if err := asker.AskSocialLogin(&chosen); err != nil {
				return sociallogin.Settings{}, err
			}
		}
	}
	if err := chosen.Validate(); err != nil {
		return sociallogin.Settings{}, err
	}
	// Check the Apple key now, before any container starts, instead of
	// failing half way through the boot when provisioning reads it.
	if chosen.AppleEnabled() {
		if _, err := a.keyReader()(chosen.ApplePrivateKeyFile); err != nil {
			return sociallogin.Settings{}, fmt.Errorf("alfheim-setup: Apple sign-in: %w", err)
		}
	}
	return chosen, nil
}

// keyReader returns the configured KeyReader, defaulting to the real one.
func (a *App) keyReader() KeyReader {
	if a.ReadKey != nil {
		return a.ReadKey
	}
	return security.ReadPrivateKeyFile
}

// KeyReader reads the Apple .p8 key. Production uses
// security.ReadPrivateKeyFile, which refuses a file with loose permissions.
type KeyReader func(path string) ([]byte, error)

// socialLoginSpecs turns the social login settings stored in an .env into
// the provider specs provisioning reconciles. Every provider kind is listed,
// enabled or not, so one the operator switched off is taken off the login
// page. The Apple key is read from its file here and only ever passed on to
// Zitadel.
func socialLoginSpecs(env map[string]string, readKey KeyReader) ([]provisioning.IDPSpec, error) {
	s := sociallogin.FromEnv(env)
	if err := s.Validate(); err != nil {
		return nil, err
	}
	google := provisioning.IDPSpec{
		Kind:                provisioning.IDPGoogle,
		ClientID:            s.GoogleClientID,
		ClientSecret:        s.GoogleClientSecret,
		ExistingFingerprint: env[provisioning.FingerprintEnvKey(provisioning.IDPGoogle)],
	}
	apple := provisioning.IDPSpec{
		Kind:                provisioning.IDPApple,
		ClientID:            s.AppleClientID,
		TeamID:              s.AppleTeamID,
		KeyID:               s.AppleKeyID,
		ExistingFingerprint: env[provisioning.FingerprintEnvKey(provisioning.IDPApple)],
	}
	if s.AppleEnabled() {
		key, err := readKey(s.ApplePrivateKeyFile)
		if err != nil {
			return nil, fmt.Errorf("alfheim-setup: Apple sign-in: %w", err)
		}
		apple.PrivateKey = key
	}
	return []provisioning.IDPSpec{google, apple}, nil
}

// idpTitles are the provider names and consoles printed for the operator.
var idpTitles = map[provisioning.IDPKind]string{
	provisioning.IDPGoogle: "Google (register it under APIs & Services -> Credentials -> your OAuth client -> Authorized redirect URIs)",
	provisioning.IDPApple:  "Apple (register it under Certificates, IDs & Profiles -> your Services ID -> Return URLs)",
}

// printSocialLogin tells the operator what happened to each provider and the
// exact redirect URI to register at the provider. It never prints a secret.
func printSocialLogin(w io.Writer, outcomes []provisioning.IDPOutcome) {
	open := false
	for _, o := range outcomes {
		switch o.Action {
		case provisioning.IDPAbsent:
			continue
		case provisioning.IDPRemoved:
			fmt.Fprintf(w, "Social login: %s sign-in was switched off and removed from the login page.\n", o.Kind)
			continue
		}
		open = true
		fmt.Fprintf(w, "Social login: %s sign-in %s. Redirect URI for %s:\n    %s\n",
			o.Kind, o.Action, idpTitles[o.Kind], o.RedirectURI)
	}
	if open {
		fmt.Fprintln(w, "  Note: anyone with an account at an enabled provider who can reach this instance can now sign in\n"+
			"  and create their own household (ADR 0008). Restrict the audience at the provider to keep it closed.")
	}
}

// applySocialLoginOverrides merges social login values the operator passed
// explicitly (flags or the environment) into existing, a parsed .env, and
// returns the .env updates to persist. Without explicit values the .env
// decides and nothing is returned.
func applySocialLoginOverrides(existing map[string]string, s sociallogin.Settings) (map[string]string, error) {
	if !s.Explicit() {
		return nil, nil
	}
	merged := s.Merge(sociallogin.FromEnv(existing))
	if err := merged.Validate(); err != nil {
		return nil, err
	}
	updates := merged.EnvValues()
	for k, v := range updates {
		existing[k] = v
	}
	return updates, nil
}

// authOrigin is the public origin of the auth host, the OIDC issuer.
func authOrigin(authHost string, secure bool) string {
	if secure {
		return "https://" + authHost
	}
	return "http://" + authHost
}
