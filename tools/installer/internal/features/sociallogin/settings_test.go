package sociallogin

import (
	"flag"
	"io"
	"strings"
	"testing"
)

func TestFromEnvAndEnvValuesRoundTrip(t *testing.T) {
	env := map[string]string{GoogleClientIDKey: " gid ", GoogleClientSecretKey: "gsecret"}
	s := FromEnv(env)
	if s.GoogleClientID != "gid" || s.GoogleClientSecret != "gsecret" {
		t.Fatalf("FromEnv() = %+v", s)
	}
	if got := FromEnv(s.EnvValues()); got != s {
		t.Errorf("round trip = %+v, want %+v", got, s)
	}
}

func TestMergeKeepsExplicitValues(t *testing.T) {
	got := Settings{GoogleClientID: "new"}.Merge(Settings{GoogleClientID: "old", GoogleClientSecret: "secret"})
	if got.GoogleClientID != "new" || got.GoogleClientSecret != "secret" {
		t.Errorf("Merge() = %+v", got)
	}
}

func TestValidate(t *testing.T) {
	for name, tc := range map[string]struct {
		s       Settings
		wantErr bool
	}{
		"off":            {Settings{}, false},
		"google":         {Settings{GoogleClientID: "id", GoogleClientSecret: "secret"}, false},
		"id only":        {Settings{GoogleClientID: "id"}, true},
		"secret only":    {Settings{GoogleClientSecret: "secret"}, true},
		"whitespace":     {Settings{GoogleClientID: "i d", GoogleClientSecret: "secret"}, true},
		"newline secret": {Settings{GoogleClientID: "id", GoogleClientSecret: "se\ncret"}, true},
	} {
		if err := tc.s.Validate(); (err != nil) != tc.wantErr {
			t.Errorf("%s: Validate() = %v, wantErr %t", name, err, tc.wantErr)
		}
	}
}

func TestEnabledExplicitAndString(t *testing.T) {
	s := Settings{GoogleClientID: "id", GoogleClientSecret: "top-secret"}
	if !s.GoogleEnabled() || !s.Configured() || !s.Explicit() {
		t.Error("a configured Google provider must report enabled")
	}
	if (Settings{}).Configured() || (Settings{}).Explicit() {
		t.Error("empty settings are off")
	}
	if strings.Contains(s.String(), "top-secret") || !strings.Contains(s.String(), "google=true") {
		t.Errorf("String() = %q", s.String())
	}
}

func TestRegisterFlagsAndApplyEnv(t *testing.T) {
	var s Settings
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	RegisterFlags(fs, &s)
	if err := fs.Parse([]string{"--google-client-id", "flag-id"}); err != nil {
		t.Fatal(err)
	}
	env := map[string]string{GoogleClientIDKey: "env-id", GoogleClientSecretKey: "env-secret"}
	s.ApplyEnv(func(k string) string { return env[k] })
	if s.GoogleClientID != "flag-id" || s.GoogleClientSecret != "env-secret" {
		t.Errorf("settings = %+v, want the flag to win and the secret from the environment", s)
	}

	t.Setenv(GoogleClientSecretKey, "process-secret")
	var fromProcess Settings
	fromProcess.ApplyEnv(nil)
	if fromProcess.GoogleClientSecret != "process-secret" {
		t.Errorf("ApplyEnv(nil) = %+v, want os.Getenv to be used", fromProcess)
	}
}

func validApple() Settings {
	return Settings{
		AppleClientID: "com.example.signin", AppleTeamID: "ABCDE12345", AppleKeyID: "FGHIJ67890",
		ApplePrivateKeyFile: "/etc/alfheim/AuthKey.p8",
	}
}

func TestValidateApple(t *testing.T) {
	missing := validApple()
	missing.AppleKeyID = ""
	shortTeam := validApple()
	shortTeam.AppleTeamID = "ABC"
	relative := validApple()
	relative.ApplePrivateKeyFile = "AuthKey.p8"
	spaced := validApple()
	spaced.AppleClientID = "com.example signin"
	for name, tc := range map[string]struct {
		s       Settings
		wantErr string
	}{
		"complete":      {validApple(), ""},
		"one missing":   {missing, "needs"},
		"short team id": {shortTeam, "10 characters"},
		"relative path": {relative, "absolute path"},
		"whitespace":    {spaced, "whitespace"},
	} {
		err := tc.s.Validate()
		if tc.wantErr == "" && err != nil || tc.wantErr != "" && (err == nil || !strings.Contains(err.Error(), tc.wantErr)) {
			t.Errorf("%s: Validate() = %v, want %q", name, err, tc.wantErr)
		}
	}
	if !validApple().AppleEnabled() || !validApple().Configured() || validApple().GoogleEnabled() {
		t.Error("Apple alone must count as configured")
	}
}

func TestAppleFlagsAndEnvRoundTrip(t *testing.T) {
	var s Settings
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	RegisterFlags(fs, &s)
	if err := fs.Parse([]string{
		"--apple-client-id", "com.example.signin", "--apple-team-id", "ABCDE12345",
		"--apple-key-id", "FGHIJ67890", "--apple-private-key-file", "/etc/alfheim/AuthKey.p8",
	}); err != nil {
		t.Fatal(err)
	}
	if s != validApple() {
		t.Errorf("flags = %+v", s)
	}
	if FromEnv(s.EnvValues()) != s {
		t.Error("Apple values must round-trip through .env")
	}
}
