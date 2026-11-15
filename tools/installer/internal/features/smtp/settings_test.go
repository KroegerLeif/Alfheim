package smtp

import (
	"flag"
	"io"
	"strings"
	"testing"
)

func valid() Settings {
	return Settings{
		Host: "smtp.example.com", Port: "465", User: "alfheim", Password: "secret",
		SenderAddress: "alfheim@example.com", SenderName: "Alfheim", TLS: "true",
	}
}

func TestValidate(t *testing.T) {
	with := func(change func(*Settings)) Settings {
		s := valid()
		change(&s)
		return s
	}
	for name, tc := range map[string]struct {
		s       Settings
		wantErr string
	}{
		"off":               {Settings{}, ""},
		"complete":          {valid(), ""},
		"open relay":        {with(func(s *Settings) { s.User, s.Password = "", "" }), ""},
		"defaults left out": {Settings{Host: "smtp.example.com", SenderAddress: "a@example.com"}, ""},
		"no host":           {Settings{User: "u"}, HostKey},
		"host with port":    {with(func(s *Settings) { s.Host = "smtp.example.com:587" }), "bare host"},
		"host with scheme":  {with(func(s *Settings) { s.Host = "smtp://smtp.example.com" }), "bare host"},
		"port not a number": {with(func(s *Settings) { s.Port = "smtp" }), PortKey},
		"port out of range": {with(func(s *Settings) { s.Port = "70000" }), PortKey},
		"no sender":         {with(func(s *Settings) { s.SenderAddress = "" }), SenderAddressKey},
		"sender with name":  {with(func(s *Settings) { s.SenderAddress = "Alfheim <a@example.com>" }), "plain e-mail"},
		"sender not mail":   {with(func(s *Settings) { s.SenderAddress = "alfheim" }), "plain e-mail"},
		"user only":         {with(func(s *Settings) { s.Password = "" }), "go together"},
		"password only":     {with(func(s *Settings) { s.User = "" }), "go together"},
		"newline password":  {with(func(s *Settings) { s.Password = "a\nb" }), "line breaks"},
		"bad tls":           {with(func(s *Settings) { s.TLS = "maybe" }), TLSKey},
	} {
		err := tc.s.Validate()
		if tc.wantErr == "" && err != nil || tc.wantErr != "" && (err == nil || !strings.Contains(err.Error(), tc.wantErr)) {
			t.Errorf("%s: Validate() = %v, want %q", name, err, tc.wantErr)
		}
	}
}

func TestWithDefaults(t *testing.T) {
	got := Settings{Host: "smtp.example.com"}.WithDefaults()
	if got.Port != DefaultPort || got.SenderName != DefaultSenderName || got.TLS != DefaultTLS {
		t.Errorf("WithDefaults() = %+v", got)
	}
	if (Settings{}).WithDefaults() != (Settings{}) {
		t.Error("an unconfigured server must stay empty, so .env keeps e-mail off")
	}
	if kept := valid().WithDefaults(); kept != valid() {
		t.Errorf("WithDefaults() overwrote explicit values: %+v", kept)
	}
}

func TestTLSEnabled(t *testing.T) {
	for value, want := range map[string]bool{"": true, "true": true, "1": true, "false": false, "0": false} {
		if got := (Settings{TLS: value}).TLSEnabled(); got != want {
			t.Errorf("TLSEnabled(%q) = %t, want %t", value, got, want)
		}
	}
}

func TestEnvRoundTripAndMerge(t *testing.T) {
	if got := FromEnv(valid().EnvValues()); got != valid() {
		t.Errorf("round trip = %+v", got)
	}
	got := Settings{Host: " new.example.com "}.Merge(valid())
	if got.Host != "new.example.com" || got.Password != "secret" {
		t.Errorf("Merge() = %+v", got)
	}
}

func TestRegisterFlagsAndApplyEnv(t *testing.T) {
	var s Settings
	fs := flag.NewFlagSet("test", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	RegisterFlags(fs, &s)
	if err := fs.Parse([]string{
		"--smtp-host", "flag.example.com", "--smtp-port", "465", "--smtp-user", "u",
		"--smtp-sender-address", "a@example.com", "--smtp-sender-name", "Home", "--smtp-tls", "false",
	}); err != nil {
		t.Fatal(err)
	}
	if fs.Parse([]string{"--smtp-password", "x"}) == nil {
		t.Error("the password must have no flag")
	}
	env := map[string]string{HostKey: "env.example.com", PasswordKey: "env-secret"}
	s.ApplyEnv(func(k string) string { return env[k] })
	if s.Host != "flag.example.com" || s.Password != "env-secret" || s.TLS != "false" || s.SenderName != "Home" {
		t.Errorf("settings = %+v, want the flag to win and the password from the environment", s)
	}

	t.Setenv(PasswordKey, "process-secret")
	var fromProcess Settings
	fromProcess.ApplyEnv(nil)
	if fromProcess.Password != "process-secret" {
		t.Errorf("ApplyEnv(nil) = %+v, want os.Getenv to be used", fromProcess)
	}
}

func TestExplicitAndString(t *testing.T) {
	if (Settings{}).Explicit() || !valid().Explicit() {
		t.Error("Explicit() must report whether any value was given")
	}
	if got := (Settings{}).String(); got != "smtp=off" {
		t.Errorf("String() = %q", got)
	}
	got := valid().String()
	if strings.Contains(got, "secret") || !strings.Contains(got, "smtp.example.com:465") {
		t.Errorf("String() = %q, want the server without the password", got)
	}
}

func TestSummary(t *testing.T) {
	if got := Summary(Settings{}); got != SkippedNotice {
		t.Errorf("Summary(off) = %q", got)
	}
	for _, want := range []string{"password reset", "invitations", "verification", "Self-registration stays off"} {
		if !strings.Contains(SkippedNotice, want) {
			t.Errorf("SkippedNotice lacks %q", want)
		}
	}
	got := Summary(Settings{Host: "smtp.example.com", SenderAddress: "a@example.com", Password: "secret"})
	if !strings.Contains(got, "smtp.example.com:587 as a@example.com") || strings.Contains(got, "secret") {
		t.Errorf("Summary(on) = %q", got)
	}
}
