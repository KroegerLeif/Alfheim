// Package sociallogin holds the operator's optional social login settings
// (Sign in with Google) and how they travel between flags, the environment,
// the wizard and .env. Social login is off unless the operator supplies a
// provider's credentials; see docs/en/how-to/social-login.md and ADR 0008.
package sociallogin

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
)

// .env variables the settings are stored in.
const (
	GoogleClientIDKey     = "ALFHEIM_GOOGLE_CLIENT_ID"
	GoogleClientSecretKey = "ALFHEIM_GOOGLE_CLIENT_SECRET" //nolint:gosec // G101: a variable name, not a credential
)

// Settings are the social login credentials. An empty provider is disabled.
type Settings struct {
	GoogleClientID     string
	GoogleClientSecret string
}

// FromEnv picks the social login variables out of an .env map.
func FromEnv(env map[string]string) Settings {
	return Settings{
		GoogleClientID:     strings.TrimSpace(env[GoogleClientIDKey]),
		GoogleClientSecret: strings.TrimSpace(env[GoogleClientSecretKey]),
	}
}

// Merge returns s with every empty value filled from fallback. It is how an
// earlier run's choice survives a re-run that does not mention it.
func (s Settings) Merge(fallback Settings) Settings {
	return Settings{
		GoogleClientID:     firstNonEmpty(s.GoogleClientID, fallback.GoogleClientID),
		GoogleClientSecret: firstNonEmpty(s.GoogleClientSecret, fallback.GoogleClientSecret),
	}
}

// GoogleEnabled reports whether Sign in with Google is configured.
func (s Settings) GoogleEnabled() bool { return s.GoogleClientID != "" }

// Configured reports whether any provider is configured.
func (s Settings) Configured() bool { return s.GoogleEnabled() }

// Validate rejects a half-configured provider, which Zitadel would refuse or,
// worse, accept with a credential that can never work.
func (s Settings) Validate() error {
	if (s.GoogleClientID == "") != (s.GoogleClientSecret == "") {
		return errors.New("sociallogin: Google sign-in needs both " + GoogleClientIDKey + " and " +
			GoogleClientSecretKey + " (leave both empty to switch it off)")
	}
	if strings.ContainsAny(s.GoogleClientID+s.GoogleClientSecret, " \t\r\n") {
		return errors.New("sociallogin: the Google client id and secret must not contain whitespace")
	}
	return nil
}

// EnvValues returns the settings as .env values.
func (s Settings) EnvValues() map[string]string {
	return map[string]string{
		GoogleClientIDKey:     s.GoogleClientID,
		GoogleClientSecretKey: s.GoogleClientSecret,
	}
}

// RegisterFlags adds the social login flags to fs, writing into s. The
// Google client secret has no flag on purpose: a flag value is visible to
// every local user in the process list, so it is read from the environment
// (ALFHEIM_GOOGLE_CLIENT_SECRET) or .env only.
func RegisterFlags(fs *flag.FlagSet, s *Settings) {
	fs.StringVar(&s.GoogleClientID, "google-client-id", "", "Google OAuth client id for Sign in with Google")
}

// ApplyEnv fills every value still empty from the process environment
// (lookup is os.Getenv in production).
func (s *Settings) ApplyEnv(lookup func(string) string) {
	if lookup == nil {
		lookup = os.Getenv
	}
	*s = s.Merge(FromEnv(map[string]string{
		GoogleClientIDKey:     lookup(GoogleClientIDKey),
		GoogleClientSecretKey: lookup(GoogleClientSecretKey),
	}))
}

// Explicit reports whether s carries any value, i.e. the operator passed
// one through a flag or the environment.
func (s Settings) Explicit() bool { return s != Settings{} }

// String never prints a secret, so a Settings value is safe to log.
func (s Settings) String() string {
	return fmt.Sprintf("google=%t", s.GoogleEnabled())
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}
