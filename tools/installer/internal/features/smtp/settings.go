// Package smtp holds the operator's optional outgoing mail server for
// Zitadel and how it travels between flags, the environment, the wizard and
// .env. Without it Zitadel cannot send password resets, invitations or
// e-mail verification codes; see docs/en/how-to/configure-smtp.md.
package smtp

import (
	"errors"
	"fmt"
	"net/mail"
	"strconv"
	"strings"
)

// .env variables the settings are stored in.
const (
	HostKey          = "ALFHEIM_SMTP_HOST"
	PortKey          = "ALFHEIM_SMTP_PORT"
	UserKey          = "ALFHEIM_SMTP_USER"
	PasswordKey      = "ALFHEIM_SMTP_PASSWORD" //nolint:gosec // G101: a variable name, not a credential
	SenderAddressKey = "ALFHEIM_SMTP_SENDER_ADDRESS"
	SenderNameKey    = "ALFHEIM_SMTP_SENDER_NAME"
	TLSKey           = "ALFHEIM_SMTP_TLS"
)

// Defaults filled in once a host is set: the submission port, the product
// name as sender, and TLS, because Zitadel refuses to send credentials over
// a plain connection to anything but localhost.
const (
	DefaultPort       = "587"
	DefaultSenderName = "Alfheim"
	DefaultTLS        = "true"
)

// Settings are the SMTP values. Every field is a string so that a value
// missing on this run falls back to the previous run's one the same way for
// all of them. An empty Host means SMTP is off.
type Settings struct {
	Host          string
	Port          string
	User          string
	Password      string
	SenderAddress string
	SenderName    string
	// TLS is "true" or "false". True lets Zitadel use implicit TLS (port
	// 465) or STARTTLS (port 587), whichever the server speaks.
	TLS string
}

// fields maps every .env key to its field, so the conversions below cannot
// miss one.
func (s *Settings) fields() map[string]*string {
	return map[string]*string{
		HostKey:          &s.Host,
		PortKey:          &s.Port,
		UserKey:          &s.User,
		PasswordKey:      &s.Password,
		SenderAddressKey: &s.SenderAddress,
		SenderNameKey:    &s.SenderName,
		TLSKey:           &s.TLS,
	}
}

// FromEnv picks the SMTP variables out of an .env map.
func FromEnv(env map[string]string) Settings {
	var s Settings
	for key, field := range s.fields() {
		*field = strings.TrimSpace(env[key])
	}
	return s
}

// Merge returns s with every empty value filled from fallback. It is how an
// earlier run's choice survives a re-run that does not mention it.
func (s Settings) Merge(fallback Settings) Settings {
	out := s
	fb := fallback.fields()
	for key, field := range out.fields() {
		if v := strings.TrimSpace(*field); v != "" {
			*field = v
			continue
		}
		*field = strings.TrimSpace(*fb[key])
	}
	return out
}

// WithDefaults fills the port, sender name and TLS of a configured server
// with their defaults, so .env records exactly what Zitadel was given.
func (s Settings) WithDefaults() Settings {
	if !s.Configured() {
		return s
	}
	if s.Port == "" {
		s.Port = DefaultPort
	}
	if s.SenderName == "" {
		s.SenderName = DefaultSenderName
	}
	if s.TLS == "" {
		s.TLS = DefaultTLS
	}
	return s
}

// Configured reports whether an SMTP server is set.
func (s Settings) Configured() bool { return s.Host != "" }

// TLSEnabled reports whether TLS is on; anything but an explicit false is.
func (s Settings) TLSEnabled() bool {
	on, err := strconv.ParseBool(s.TLS)
	return err != nil || on
}

// Validate rejects settings Zitadel would refuse, or accept and then fail to
// deliver with: values without a host, a sender that is no address, a bad
// port, and a user without a password or the other way round.
func (s Settings) Validate() error {
	if !s.Configured() {
		if s != (Settings{}) {
			return errors.New("smtp: " + HostKey + " is required once any other ALFHEIM_SMTP_* value is set " +
				"(leave them all empty to switch e-mail off)")
		}
		return nil
	}
	if strings.ContainsAny(s.Host, " \t\r\n/:@") {
		return fmt.Errorf("smtp: %s must be a bare host name without port or scheme, got %q", HostKey, s.Host)
	}
	if s.Port != "" {
		if port, err := strconv.Atoi(s.Port); err != nil || port < 1 || port > 65535 {
			return fmt.Errorf("smtp: %s must be a port number between 1 and 65535, got %q", PortKey, s.Port)
		}
	}
	if s.SenderAddress == "" {
		return errors.New("smtp: " + SenderAddressKey + " is required (the From address of every e-mail)")
	}
	if addr, err := mail.ParseAddress(s.SenderAddress); err != nil || addr.Address != s.SenderAddress {
		return fmt.Errorf("smtp: %s must be a plain e-mail address, got %q", SenderAddressKey, s.SenderAddress)
	}
	if (s.User == "") != (s.Password == "") {
		return errors.New("smtp: " + UserKey + " and " + PasswordKey + " go together " +
			"(leave both empty for a relay without authentication)")
	}
	if strings.ContainsAny(s.User+s.Password+s.SenderName, "\r\n") {
		return errors.New("smtp: the user, password and sender name must not contain line breaks")
	}
	if s.TLS != "" {
		if _, err := strconv.ParseBool(s.TLS); err != nil {
			return fmt.Errorf("smtp: %s must be true or false, got %q", TLSKey, s.TLS)
		}
	}
	return nil
}

// EnvValues returns the settings as .env values.
func (s Settings) EnvValues() map[string]string {
	out := map[string]string{}
	for key, field := range s.fields() {
		out[key] = *field
	}
	return out
}

// Explicit reports whether s carries any value, i.e. the operator passed
// one through a flag or the environment.
func (s Settings) Explicit() bool { return s != Settings{} }

// String never prints the password, so a Settings value is safe to log.
func (s Settings) String() string {
	if !s.Configured() {
		return "smtp=off"
	}
	return fmt.Sprintf("smtp=%s:%s sender=%s tls=%t auth=%t",
		s.Host, s.Port, s.SenderAddress, s.TLSEnabled(), s.User != "")
}
