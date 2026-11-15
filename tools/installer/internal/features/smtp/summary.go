package smtp

import "fmt"

// Summary is the install summary's e-mail section. Without SMTP it spells
// out what does not work, so the operator learns it from the installer
// rather than from a user waiting for a mail that never comes.
func Summary(s Settings) string {
	if !s.Configured() {
		return SkippedNotice
	}
	s = s.WithDefaults()
	return fmt.Sprintf("  E-mail (SMTP)\n"+
		"    Zitadel sends e-mail through %s:%s as %s.\n"+
		"    Password reset, invitations and e-mail verification are available.\n",
		s.Host, s.Port, s.SenderAddress)
}

// SkippedNotice is the summary's e-mail section when SMTP was skipped.
const SkippedNotice = `  E-mail (SMTP): NOT CONFIGURED
    Zitadel cannot send e-mail, so these do not work:
      - password reset ("Forgot password" is hidden on the login page)
      - invitations and initial-password mails for users created in the console
      - e-mail verification codes
    Self-registration stays off, so no sign-in flow waits for an e-mail. Give
    users a password in the Zitadel console instead. To add a mail server, set the
    ALFHEIM_SMTP_* values in .env and re-run alfheim-setup
    (see docs/en/how-to/configure-smtp.md).
`
