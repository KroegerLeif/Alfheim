package provisioning

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
)

// SMTPFingerprintEnvKey is the .env variable that records the fingerprint of
// the last provisioned SMTP configuration.
const SMTPFingerprintEnvKey = "ZITADEL_SMTP_FINGERPRINT"

// SMTPProviderDescription names the e-mail provider the installer manages.
// It is how EnsureSMTP finds its own provider again and tells it apart from
// one an operator added in the Zitadel console.
const SMTPProviderDescription = "Alfheim installer (alfheim-setup)"

// SMTPSpec declares the SMTP e-mail provider EnsureSMTP reconciles. A spec
// without a Host means e-mail is off: the installer's provider is removed.
type SMTPSpec struct {
	Host string
	Port string
	// User and Password authenticate with PLAIN auth; both empty means a
	// relay without authentication. The password is sent to Zitadel only and
	// never logged.
	User          string
	Password      string
	SenderAddress string
	SenderName    string
	TLS           bool
	// ExistingFingerprint is the Fingerprint recorded by the previous run.
	// The password cannot be read back from Zitadel, so a matching
	// fingerprint is what proves it did not change.
	ExistingFingerprint string
}

// Enabled reports whether the operator configured a mail server.
func (s SMTPSpec) Enabled() bool { return s.Host != "" }

// HostPort is the "host:port" Zitadel expects in its host field.
func (s SMTPSpec) HostPort() string { return net.JoinHostPort(s.Host, s.Port) }

// Fingerprint is a SHA-256 over every configured value, the password
// included. Recording it in .env lets the next run detect a changed password
// without keeping a second copy of it. It is empty when SMTP is off.
func (s SMTPSpec) Fingerprint() string {
	if !s.Enabled() {
		return ""
	}
	h := sha256.New()
	for _, part := range []string{
		s.Host, s.Port, s.User, s.Password, s.SenderAddress, s.SenderName, fmt.Sprint(s.TLS),
	} {
		// The length prefix keeps ("ab", "c") and ("a", "bc") apart.
		_, _ = fmt.Fprintf(h, "%d:%s", len(part), part)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// SMTPAction is what EnsureSMTP did with the installer's e-mail provider.
type SMTPAction string

const (
	// SMTPCreated means the provider did not exist and was created.
	SMTPCreated SMTPAction = "created"
	// SMTPUpdated means an existing provider was changed or re-activated.
	SMTPUpdated SMTPAction = "updated"
	// SMTPUnchanged means the provider already matched the spec.
	SMTPUnchanged SMTPAction = "unchanged"
	// SMTPRemoved means SMTP was switched off and the provider deleted.
	SMTPRemoved SMTPAction = "removed"
	// SMTPAbsent means SMTP is off and the installer has no provider.
	SMTPAbsent SMTPAction = "absent"
)

// SMTPOutcome reports the reconciled e-mail configuration.
type SMTPOutcome struct {
	Action SMTPAction
	// ID is Zitadel's provider id; empty when none exists.
	ID string
	// Fingerprint is what to record in .env for the next run.
	Fingerprint string
	// ExternalProvider reports that SMTP is off in the installer but an
	// e-mail provider the operator set up in the console is active, so mail
	// still works and the password reset link was left alone.
	ExternalProvider bool
	// PasswordResetHidden reports whether the login page hides "Forgot
	// password", which it does exactly when no e-mail provider is active.
	PasswordResetHidden bool
}

// MailWorks reports whether Zitadel has an active e-mail provider.
func (o SMTPOutcome) MailWorks() bool { return !o.PasswordResetHidden }

// SMTPWarning is the operator-facing message for an SMTP configuration that
// could not be applied on an existing installation.
func SMTPWarning(cause error) string {
	return fmt.Sprintf("WARNING: the SMTP e-mail provider could not be configured in Zitadel: %v\n"+
		"  Sign-in still works, but password reset, invitations and e-mail verification may not.\n"+
		"  Check the ALFHEIM_SMTP_* values in .env and re-run alfheim-setup update (or provision)\n"+
		"  with a PAT that has IAM_OWNER rights. See docs/en/how-to/configure-smtp.md.", cause)
}
