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
	answers := *s
	hidden := func() bool { return !enable }

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Set up external sign-in (Google, Apple)?").
				Description("No keeps password sign-in only (the default). Yes adds \"Sign in with Google\" "+
					"or \"Sign in with Apple\"; anyone with such an account who reaches this instance can "+
					"then sign in and create a household. See docs/en/how-to/social-login.md.").
				Value(&enable),
		),
		huh.NewGroup(
			huh.NewInput().
				Title("Google client id").
				Description("OAuth client id from Google Cloud. Leave empty to skip Google.").
				Placeholder("1234567890-abc.apps.googleusercontent.com").
				Value(&answers.GoogleClientID),
			huh.NewInput().
				Title("Google client secret").
				EchoMode(huh.EchoModePassword).
				Value(&answers.GoogleClientSecret),
		).WithHideFunc(hidden),
		huh.NewGroup(
			huh.NewInput().
				Title("Apple Services ID").
				Description("Identifier of the Services ID. Leave every Apple field empty to skip Apple.").
				Placeholder("com.example.alfheim.signin").
				Value(&answers.AppleClientID),
			huh.NewInput().Title("Apple Team ID").Placeholder("ABCDE12345").Value(&answers.AppleTeamID),
			huh.NewInput().Title("Apple Key ID").Placeholder("FGHIJ67890").Value(&answers.AppleKeyID),
			huh.NewInput().
				Title("Apple private key file").
				Description("Absolute path of the .p8 key, mode 0600. The key stays in the file and in Zitadel.").
				Placeholder("/etc/alfheim/AuthKey_FGHIJ67890.p8").
				Value(&answers.ApplePrivateKeyFile),
		).WithHideFunc(hidden),
	)
	if err := form.Run(); err != nil {
		return err
	}

	if !enable {
		*s = Settings{}
		return nil
	}
	values := answers.fields()
	for key, field := range s.fields() {
		*field = strings.TrimSpace(*values[key])
	}
	return nil
}
