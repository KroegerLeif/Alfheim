package app

import (
	"fmt"
	"io"

	"alfheim/installer/internal/features/provisioning"
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
	return chosen, nil
}

// socialLoginSpecs turns the social login settings stored in an .env into
// the provider specs provisioning reconciles. Every provider kind is listed,
// enabled or not, so one the operator switched off is taken off the login
// page.
func socialLoginSpecs(env map[string]string) ([]provisioning.IDPSpec, error) {
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
	return []provisioning.IDPSpec{google}, nil
}

// idpTitles are the provider names and consoles printed for the operator.
var idpTitles = map[provisioning.IDPKind]string{
	provisioning.IDPGoogle: "Google (register it under APIs & Services -> Credentials -> your OAuth client -> Authorized redirect URIs)",
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
