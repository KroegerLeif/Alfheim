package app

import (
	"fmt"
	"io"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/smtp"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// SMTPAsker is implemented by wizards that can also run the optional
// "e-mail" step. The headless path and test doubles do not need to.
type SMTPAsker interface {
	AskSMTP(s *smtp.Settings) error
}

// configureSMTP resolves the SMTP settings: flags and the environment first,
// then what an earlier run left in .env, and in the interactive wizard
// whatever the operator answers (pre-filled with those). The wizard step is
// skipped when a flag or variable already answered it.
func (a *App) configureSMTP(layout paths.Layout) (smtp.Settings, error) {
	chosen := a.Options.SMTP
	explicit := chosen.Explicit()

	if previous, err := envfile.ParseFile(layout.EnvFile()); err == nil {
		chosen = chosen.Merge(smtp.FromEnv(previous))
	}

	if !a.Options.NonInteractive && !explicit {
		if asker, ok := a.Wizard.(SMTPAsker); ok {
			if err := asker.AskSMTP(&chosen); err != nil {
				return smtp.Settings{}, err
			}
		}
	}
	if err := chosen.Validate(); err != nil {
		return smtp.Settings{}, err
	}
	return chosen.WithDefaults(), nil
}

// smtpSpec turns the SMTP settings stored in an .env into the spec
// provisioning reconciles. A spec is always returned, so a mail server the
// operator emptied is removed from Zitadel again.
func smtpSpec(env map[string]string) (provisioning.SMTPSpec, error) {
	s := smtp.FromEnv(env)
	if err := s.Validate(); err != nil {
		return provisioning.SMTPSpec{}, err
	}
	s = s.WithDefaults()
	return provisioning.SMTPSpec{
		Host:                s.Host,
		Port:                s.Port,
		User:                s.User,
		Password:            s.Password,
		SenderAddress:       s.SenderAddress,
		SenderName:          s.SenderName,
		TLS:                 s.Configured() && s.TLSEnabled(),
		ExistingFingerprint: env[provisioning.SMTPFingerprintEnvKey],
	}, nil
}

// applySMTPOverrides merges SMTP values the operator passed explicitly
// (flags or the environment) into existing, a parsed .env, and returns the
// .env updates to persist. Without explicit values the .env decides and
// nothing is returned.
func applySMTPOverrides(existing map[string]string, s smtp.Settings) (map[string]string, error) {
	if !s.Explicit() {
		return nil, nil
	}
	merged := s.Merge(smtp.FromEnv(existing))
	if err := merged.Validate(); err != nil {
		return nil, err
	}
	updates := merged.WithDefaults().EnvValues()
	for k, v := range updates {
		existing[k] = v
	}
	return updates, nil
}

// printSMTP tells the operator what provisioning did with e-mail. A nil
// outcome means it failed on an existing installation, which the warnings
// already report. It never prints the password.
func printSMTP(w io.Writer, out *provisioning.SMTPOutcome) {
	switch {
	case out == nil:
		return
	case out.Action == provisioning.SMTPRemoved:
		fmt.Fprintln(w, "E-mail (SMTP): switched off; the installer's mail server was removed from Zitadel.")
	case out.Action != provisioning.SMTPAbsent:
		fmt.Fprintf(w, "E-mail (SMTP): mail server %s and active.\n", out.Action)
		return
	}
	if out.ExternalProvider {
		fmt.Fprintln(w, "E-mail (SMTP): not set in .env; an e-mail provider configured in the Zitadel console stays active.")
		return
	}
	fmt.Fprintln(w, "E-mail (SMTP): not configured. Password reset, invitations and e-mail verification do not work;\n"+
		"  \"Forgot password\" is hidden on the login page. See docs/en/how-to/configure-smtp.md.")
}
