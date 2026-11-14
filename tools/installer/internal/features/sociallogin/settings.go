// Package sociallogin holds the operator's optional social login settings
// (Sign in with Google and with Apple) and how they travel between flags, the environment,
// the wizard and .env. Social login is off unless the operator supplies a
// provider's credentials; see docs/en/how-to/social-login.md and ADR 0008.
package sociallogin

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// .env variables the settings are stored in.
const (
	GoogleClientIDKey     = "ALFHEIM_GOOGLE_CLIENT_ID"
	GoogleClientSecretKey = "ALFHEIM_GOOGLE_CLIENT_SECRET" //nolint:gosec // G101: a variable name, not a credential
	AppleClientIDKey      = "ALFHEIM_APPLE_CLIENT_ID"
	AppleTeamIDKey        = "ALFHEIM_APPLE_TEAM_ID"
	AppleKeyIDKey         = "ALFHEIM_APPLE_KEY_ID"
	// ApplePrivateKeyFileKey holds a path. The key itself never goes into
	// .env: the installer reads it from the file and uploads it to Zitadel.
	ApplePrivateKeyFileKey = "ALFHEIM_APPLE_PRIVATE_KEY_FILE"
)

// appleIDLength is the length of an Apple Team ID and Key ID.
const appleIDLength = 10

// Settings are the social login credentials. An empty provider is disabled.
type Settings struct {
	GoogleClientID     string
	GoogleClientSecret string
	// AppleClientID is the Services ID, AppleTeamID and AppleKeyID the
	// 10-character ids from the Apple developer account, and
	// ApplePrivateKeyFile the absolute path of the .p8 key.
	AppleClientID       string
	AppleTeamID         string
	AppleKeyID          string
	ApplePrivateKeyFile string
}

// fields maps every .env key to its field, so the conversions below cannot
// miss one.
func (s *Settings) fields() map[string]*string {
	return map[string]*string{
		GoogleClientIDKey:      &s.GoogleClientID,
		GoogleClientSecretKey:  &s.GoogleClientSecret,
		AppleClientIDKey:       &s.AppleClientID,
		AppleTeamIDKey:         &s.AppleTeamID,
		AppleKeyIDKey:          &s.AppleKeyID,
		ApplePrivateKeyFileKey: &s.ApplePrivateKeyFile,
	}
}

// FromEnv picks the social login variables out of an .env map.
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
		*field = firstNonEmpty(*field, *fb[key])
	}
	return out
}

// GoogleEnabled reports whether Sign in with Google is configured.
func (s Settings) GoogleEnabled() bool { return s.GoogleClientID != "" }

// AppleEnabled reports whether Sign in with Apple is configured.
func (s Settings) AppleEnabled() bool { return s.AppleClientID != "" }

// Configured reports whether any provider is configured.
func (s Settings) Configured() bool { return s.GoogleEnabled() || s.AppleEnabled() }

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
	return s.validateApple()
}

// validateApple requires all four Apple values or none, ids of Apple's
// length, and an absolute key path (the key is read on every provisioning
// run, from wherever the installer is started).
func (s Settings) validateApple() error {
	set := 0
	for _, v := range []string{s.AppleClientID, s.AppleTeamID, s.AppleKeyID, s.ApplePrivateKeyFile} {
		if v != "" {
			set++
		}
	}
	if set == 0 {
		return nil
	}
	if set != 4 {
		return errors.New("sociallogin: Apple sign-in needs " + AppleClientIDKey + ", " + AppleTeamIDKey + ", " +
			AppleKeyIDKey + " and " + ApplePrivateKeyFileKey + " (leave all four empty to switch it off)")
	}
	if len(s.AppleTeamID) != appleIDLength || len(s.AppleKeyID) != appleIDLength {
		return fmt.Errorf("sociallogin: %s and %s must be %d characters each", AppleTeamIDKey, AppleKeyIDKey, appleIDLength)
	}
	if strings.ContainsAny(s.AppleClientID+s.AppleTeamID+s.AppleKeyID, " \t\r\n") {
		return errors.New("sociallogin: the Apple ids must not contain whitespace")
	}
	if !filepath.IsAbs(s.ApplePrivateKeyFile) {
		return fmt.Errorf("sociallogin: %s must be an absolute path, got %q", ApplePrivateKeyFileKey, s.ApplePrivateKeyFile)
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

// RegisterFlags adds the social login flags to fs, writing into s. The
// Google client secret has no flag on purpose: a flag value is visible to
// every local user in the process list, so it is read from the environment
// (ALFHEIM_GOOGLE_CLIENT_SECRET) or .env only.
func RegisterFlags(fs *flag.FlagSet, s *Settings) {
	fs.StringVar(&s.GoogleClientID, "google-client-id", "", "Google OAuth client id for Sign in with Google")
	fs.StringVar(&s.AppleClientID, "apple-client-id", "", "Apple Services ID for Sign in with Apple")
	fs.StringVar(&s.AppleTeamID, "apple-team-id", "", "Apple developer Team ID")
	fs.StringVar(&s.AppleKeyID, "apple-key-id", "", "Apple Sign in with Apple Key ID")
	fs.StringVar(&s.ApplePrivateKeyFile, "apple-private-key-file", "", "absolute path of the Apple .p8 key (mode 0600)")
}

// ApplyEnv fills every value still empty from the process environment
// (lookup is os.Getenv in production).
func (s *Settings) ApplyEnv(lookup func(string) string) {
	if lookup == nil {
		lookup = os.Getenv
	}
	env := map[string]string{}
	for key := range s.fields() {
		env[key] = lookup(key)
	}
	*s = s.Merge(FromEnv(env))
}

// Explicit reports whether s carries any value, i.e. the operator passed
// one through a flag or the environment.
func (s Settings) Explicit() bool { return s != Settings{} }

// String never prints a secret, so a Settings value is safe to log.
func (s Settings) String() string {
	return fmt.Sprintf("google=%t apple=%t", s.GoogleEnabled(), s.AppleEnabled())
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}
