package app

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/provisioning"
	"alfheim/installer/internal/features/smtp"
	"alfheim/installer/internal/shared/envfile"
)

// emailStub fakes Zitadel's e-mail provider endpoints for one provider.
type emailStub struct {
	provider    map[string]any
	password    string
	writes      int
	resetHidden bool
}

// handleEmail answers an e-mail provider request and reports whether it did.
func (l *loginPolicyStub) handleEmail(w http.ResponseWriter, r *http.Request) bool {
	if !strings.HasPrefix(r.URL.Path, "/admin/v1/email") {
		return false
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	var body map[string]any
	if r.Method != http.MethodDelete {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	m := &l.mail
	resp := map[string]any{}
	switch {
	case r.URL.Path == "/admin/v1/email/_search":
		result := []any{}
		if m.provider != nil {
			result = append(result, m.provider)
		}
		resp["result"] = result
	case r.URL.Path == "/admin/v1/email/smtp" || strings.HasPrefix(r.URL.Path, "/admin/v1/email/smtp/"):
		m.writes++
		plain, _ := body["plain"].(map[string]any)
		m.password, _ = plain["password"].(string)
		state := "EMAIL_PROVIDER_INACTIVE"
		if m.provider != nil {
			state = m.provider["state"].(string)
		}
		smtpView := map[string]any{
			"host": body["host"], "user": body["user"], "tls": body["tls"],
			"senderAddress": body["senderAddress"], "senderName": body["senderName"],
		}
		if plain != nil {
			smtpView["plain"] = map[string]any{}
		}
		m.provider = map[string]any{"id": "smtp-1", "state": state, "description": body["description"], "smtp": smtpView}
		resp["id"] = "smtp-1"
	case strings.HasSuffix(r.URL.Path, "/_activate"):
		m.writes++
		m.provider["state"] = "EMAIL_PROVIDER_ACTIVE"
	case r.Method == http.MethodDelete:
		m.writes++
		m.provider = nil
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
	return true
}

// runProvisionOnce runs the provision subcommand against srvURL.
func runProvisionOnce(t *testing.T, envPath, patPath, srvURL string, extra ...string) (string, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	args := append([]string{"--env-file", envPath, "--pat-file", patPath, "--zitadel-url", srvURL}, extra...)
	if code := RunProvision(args, &stdout, &stderr); code != ExitOK {
		t.Fatalf("RunProvision() = %d; stderr=%s", code, stderr.String())
	}
	return stdout.String(), stderr.String()
}

func newProvisionFixture(t *testing.T) (*loginPolicyStub, string, string, string) {
	t.Helper()
	policy := newLoginPolicyStub()
	srv := httptest.NewServer(zitadelStub(t, policy))
	t.Cleanup(srv.Close)
	dir := t.TempDir()
	envPath := writeProvisionEnv(t, dir, "false")
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("test-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return policy, envPath, patPath, srv.URL
}

func TestRunProvision_SMTPFlagsConfigureZitadelIdempotently(t *testing.T) {
	policy, envPath, patPath, srv := newProvisionFixture(t)
	t.Setenv(smtp.PasswordKey, "mail-secret")
	stdout, stderr := runProvisionOnce(t, envPath, patPath, srv,
		"--smtp-host", "smtp.example.com", "--smtp-user", "alfheim", "--smtp-sender-address", "alfheim@example.com")

	m := policy.mail
	if m.provider == nil || m.provider["state"] != "EMAIL_PROVIDER_ACTIVE" || m.password != "mail-secret" {
		t.Fatalf("provider = %v, password set = %t", m.provider, m.password != "")
	}
	if host := m.provider["smtp"].(map[string]any)["host"]; host != "smtp.example.com:587" {
		t.Errorf("host = %v, want the default port", host)
	}
	if strings.Contains(stdout+stderr, "mail-secret") {
		t.Error("the SMTP password must never be printed")
	}
	if !strings.Contains(stdout, "mail server created and active") {
		t.Errorf("stdout = %q", stdout)
	}
	vars, err := envfile.ParseFile(envPath)
	if err != nil {
		t.Fatal(err)
	}
	if vars[smtp.HostKey] != "smtp.example.com" || vars[smtp.PasswordKey] != "mail-secret" ||
		vars[smtp.TLSKey] != "true" || vars[provisioning.SMTPFingerprintEnvKey] == "" {
		t.Errorf(".env SMTP values = %v", smtp.FromEnv(vars))
	}

	// A re-run without flags reads the same values from .env and changes
	// nothing in Zitadel.
	t.Setenv(smtp.PasswordKey, "")
	writes := policy.mail.writes
	stdout, _ = runProvisionOnce(t, envPath, patPath, srv)
	if policy.mail.writes != writes || !strings.Contains(stdout, "mail server unchanged") {
		t.Errorf("re-run wrote %d times, stdout = %q", policy.mail.writes-writes, stdout)
	}

	// Emptying the host in .env removes the provider and hides the link.
	if err := envfile.Update(envPath, smtp.Settings{}.EnvValues()); err != nil {
		t.Fatal(err)
	}
	stdout, _ = runProvisionOnce(t, envPath, patPath, srv)
	if policy.mail.provider != nil || !policy.mail.resetHidden || !strings.Contains(stdout, "switched off") {
		t.Errorf("provider = %v, resetHidden = %t, stdout = %q", policy.mail.provider, policy.mail.resetHidden, stdout)
	}
}

func TestRunProvision_WithoutSMTPStatesTheLimitation(t *testing.T) {
	policy, envPath, patPath, srv := newProvisionFixture(t)
	stdout, _ := runProvisionOnce(t, envPath, patPath, srv)
	if !policy.mail.resetHidden {
		t.Error("without SMTP the login page must hide the password reset link")
	}
	if policy.registrationOpen() {
		t.Error("self-registration must stay off without SMTP")
	}
	for _, want := range []string{"not configured", "Password reset", "invitations", "e-mail verification"} {
		if !strings.Contains(stdout, want) {
			t.Errorf("stdout = %q, want %q", stdout, want)
		}
	}
}

func TestRunProvision_RejectsInvalidSMTP(t *testing.T) {
	_, envPath, patPath, _ := newProvisionFixture(t)
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", patPath, "--zitadel-url", "http://127.0.0.1:1",
		"--smtp-host", "smtp.example.com",
	}, &stdout, &stderr)
	if code != ExitFailure || !strings.Contains(stderr.String(), smtp.SenderAddressKey) {
		t.Fatalf("RunProvision() = %d, stderr = %q", code, stderr.String())
	}
}

func TestSMTPSpec(t *testing.T) {
	env := map[string]string{
		smtp.HostKey: "smtp.example.com", smtp.SenderAddressKey: "a@example.com", smtp.TLSKey: "false",
		provisioning.SMTPFingerprintEnvKey: "fp",
	}
	spec, err := smtpSpec(env)
	if err != nil {
		t.Fatal(err)
	}
	if spec.HostPort() != "smtp.example.com:587" || spec.TLS || spec.SenderName != "Alfheim" || spec.ExistingFingerprint != "fp" {
		t.Errorf("spec = %+v", spec)
	}
	if spec, err := smtpSpec(map[string]string{}); err != nil || spec.Enabled() {
		t.Errorf("empty .env: spec = %+v, err = %v", spec, err)
	}
	if _, err := smtpSpec(map[string]string{smtp.UserKey: "u"}); err == nil {
		t.Error("a user without a host must be rejected")
	}
}

func TestApplySMTPOverridesWithoutValuesKeepsEnv(t *testing.T) {
	updates, err := applySMTPOverrides(map[string]string{smtp.HostKey: "kept"}, smtp.Settings{})
	if err != nil || updates != nil {
		t.Errorf("updates = %v, err = %v", updates, err)
	}
}

func TestPrintSMTP(t *testing.T) {
	for name, tc := range map[string]struct {
		out  *provisioning.SMTPOutcome
		want string
	}{
		"failed":   {nil, ""},
		"created":  {&provisioning.SMTPOutcome{Action: provisioning.SMTPCreated}, "created and active"},
		"removed":  {&provisioning.SMTPOutcome{Action: provisioning.SMTPRemoved, PasswordResetHidden: true}, "switched off"},
		"skipped":  {&provisioning.SMTPOutcome{Action: provisioning.SMTPAbsent, PasswordResetHidden: true}, "not configured"},
		"external": {&provisioning.SMTPOutcome{Action: provisioning.SMTPAbsent, ExternalProvider: true}, "Zitadel console"},
	} {
		var buf bytes.Buffer
		printSMTP(&buf, tc.out)
		if tc.want == "" && buf.Len() != 0 || !strings.Contains(buf.String(), tc.want) {
			t.Errorf("%s: printSMTP() = %q, want %q", name, buf.String(), tc.want)
		}
	}
}

// smtpWizard answers the e-mail step.
type smtpWizard struct {
	stubWizard
	answer smtp.Settings
	asked  bool
}

func (w *smtpWizard) AskSMTP(s *smtp.Settings) error {
	w.asked = true
	*s = w.answer
	return nil
}

func TestInteractiveWizardStoresSMTPInEnv(t *testing.T) {
	wiz := &smtpWizard{
		stubWizard: interactiveStub(),
		answer: smtp.Settings{
			Host: "smtp.example.com", User: "u", Password: "wizard-secret", SenderAddress: "a@example.com",
		},
	}
	opts := &Options{InstallDir: t.TempDir()}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if !wiz.asked {
		t.Error("the interactive wizard must offer the e-mail step")
	}
	vars, err := envfile.ParseFile(filepath.Join(opts.InstallDir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars[smtp.HostKey] != "smtp.example.com" || vars[smtp.PortKey] != "587" || vars[smtp.PasswordKey] != "wizard-secret" {
		t.Errorf("SMTP vars = %v", smtp.FromEnv(vars))
	}
	if strings.Contains(stdout.String(), "wizard-secret") {
		t.Error("the password must never be printed")
	}
	if !strings.Contains(stdout.String(), "Zitadel sends e-mail through smtp.example.com:587") {
		t.Errorf("summary = %q", stdout.String())
	}
}

func TestInstallSummaryStatesSkippedSMTP(t *testing.T) {
	opts := &Options{InstallDir: t.TempDir(), NonInteractive: true, Domain: "example.com", AdminEmail: "ops@example.com",
		TLSStrategy: "internal"}
	app, stdout, stderr := newTestApp(t, opts, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stderr=%s", code, stderr)
	}
	if !strings.Contains(stdout.String(), smtp.SkippedNotice) {
		t.Errorf("summary = %q, want the SMTP limitation", stdout.String())
	}
}

func TestConfigureSMTPRejectsInvalidFlags(t *testing.T) {
	wiz := &smtpWizard{stubWizard: interactiveStub()}
	opts := &Options{InstallDir: t.TempDir(), SMTP: smtp.Settings{Host: "smtp.example.com"}}
	app, _, stderr := newTestApp(t, opts, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want failure", code)
	}
	if wiz.asked {
		t.Error("the wizard must not ask when a flag already answered")
	}
	if !strings.Contains(stderr.String(), smtp.SenderAddressKey) {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestParseOptionsSMTPFlagAndEnvironment(t *testing.T) {
	t.Setenv(smtp.PasswordKey, "env-secret")
	var stderr bytes.Buffer
	opts, err := ParseOptions([]string{"--smtp-host", "smtp.example.com", "--smtp-tls", "false"}, &stderr)
	if err != nil {
		t.Fatal(err)
	}
	if opts.SMTP.Host != "smtp.example.com" || opts.SMTP.Password != "env-secret" || opts.SMTP.TLS != "false" {
		t.Errorf("SMTP = %v", opts.SMTP)
	}
	if _, err := ParseOptions([]string{"--smtp-password", "x"}, &stderr); err == nil {
		t.Error("the password must not be accepted as a flag")
	}
}
