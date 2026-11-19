package smtp

import (
	"strings"

	"github.com/charmbracelet/huh"
)

// RunForm is the wizard's optional "e-mail" step. It first asks whether to
// set up SMTP at all and defaults to the current choice, so an install
// without a mail server passes it with one keypress. Answering no clears
// every value. The rules live in Settings.Validate, so the headless path
// enforces the same ones.
func RunForm(s *Settings) error {
	enable := s.Configured()
	answers := s.WithDefaults()
	if !enable {
		answers = Settings{Port: DefaultPort, SenderName: DefaultSenderName, TLS: DefaultTLS}
	}
	useTLS := answers.TLSEnabled()
	hidden := func() bool { return !enable }

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Set up e-mail (SMTP) for sign-in?").
				Description("Zitadel needs a mail server to send password resets, invitations and "+
					"e-mail verification. Without one these do not work and the \"Forgot password\" link "+
					"stays hidden. See docs/en/how-to/configure-smtp.md.").
				Value(&enable),
		),
		huh.NewGroup(
			huh.NewInput().Title("SMTP host").Placeholder("smtp.example.com").Value(&answers.Host),
			huh.NewInput().Title("SMTP port").Description("587 for STARTTLS, 465 for implicit TLS.").
				Value(&answers.Port),
			huh.NewConfirm().Title("Use TLS?").Description("Keep yes unless the relay is on this host.").
				Value(&useTLS),
			huh.NewInput().Title("SMTP user").Description("Leave empty for a relay without authentication.").
				Value(&answers.User),
			huh.NewInput().Title("SMTP password").EchoMode(huh.EchoModePassword).Value(&answers.Password),
			huh.NewInput().Title("Sender address").Placeholder("alfheim@example.com").Value(&answers.SenderAddress),
			huh.NewInput().Title("Sender name").Value(&answers.SenderName),
		).WithHideFunc(hidden),
	)
	if err := form.Run(); err != nil {
		return err
	}

	if !enable {
		*s = Settings{}
		return nil
	}
	answers.TLS = "false"
	if useTLS {
		answers.TLS = "true"
	}
	values := answers.fields()
	for key, field := range s.fields() {
		*field = strings.TrimSpace(*values[key])
	}
	return nil
}
