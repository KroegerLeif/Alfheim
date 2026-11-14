package sociallogin

import (
	"strings"

	"github.com/charmbracelet/huh"
)

// RunForm is the wizard's "external sign-in" step. It first asks whether to
// set up social login at all and defaults to no, so the usual path through
// the wizard skips it. Answering no clears every provider. The rules live in
// Settings.Validate, so the headless path enforces the same ones.
func RunForm(s *Settings) error {
	enable := s.Configured()
	google := *s

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Set up external sign-in (Google)?").
				Description("No keeps password sign-in only (the default). Yes adds a \"Sign in with Google\" "+
					"button; anyone with a Google account who reaches this instance can then sign in "+
					"and create a household. See docs/en/how-to/social-login.md.").
				Value(&enable),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("Google client id").
				Description("OAuth client id from Google Cloud. Leave empty to skip Google.").
				Placeholder("1234567890-abc.apps.googleusercontent.com").
				Value(&google.GoogleClientID),
			huh.NewInput().
				Title("Google client secret").
				EchoMode(huh.EchoModePassword).
				Value(&google.GoogleClientSecret),
		).WithHideFunc(func() bool { return !enable }),
	)
	if err := form.Run(); err != nil {
		return err
	}

	if !enable {
		*s = Settings{}
		return nil
	}
	s.GoogleClientID = strings.TrimSpace(google.GoogleClientID)
	s.GoogleClientSecret = strings.TrimSpace(google.GoogleClientSecret)
	return nil
}
