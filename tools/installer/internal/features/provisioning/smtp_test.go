package provisioning

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestSMTPSpecFingerprint(t *testing.T) {
	base := smtpTestSpec()
	if (SMTPSpec{}).Fingerprint() != "" {
		t.Error("a disabled spec has no fingerprint")
	}
	if base.Fingerprint() != smtpTestSpec().Fingerprint() {
		t.Error("the fingerprint must be deterministic")
	}
	recorded := base
	recorded.ExistingFingerprint = "anything"
	if recorded.Fingerprint() != base.Fingerprint() {
		t.Error("the recorded fingerprint must not feed into the new one")
	}
	for name, change := range map[string]func(*SMTPSpec){
		"password": func(s *SMTPSpec) { s.Password = "other" },
		"port":     func(s *SMTPSpec) { s.Port = "465" },
		"tls":      func(s *SMTPSpec) { s.TLS = false },
		"shifted":  func(s *SMTPSpec) { s.User, s.Password = "alfheimm", "ail-secret" },
	} {
		changed := smtpTestSpec()
		change(&changed)
		if changed.Fingerprint() == base.Fingerprint() {
			t.Errorf("%s: a changed value must change the fingerprint", name)
		}
	}
	if fp := base.Fingerprint(); strings.Contains(fp, "mail-secret") || len(fp) != 64 {
		t.Errorf("Fingerprint() = %q", fp)
	}
}

func TestProvision_ReconcilesSMTPAndRecordsFingerprint(t *testing.T) {
	c := newFakeClient()
	in := testInput()
	in.SMTP = smtpTestSpec()
	res, err := Provision(context.Background(), c, in, nil)
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if res.SMTP == nil || res.SMTP.Action != SMTPCreated {
		t.Fatalf("SMTP outcome = %+v", res.SMTP)
	}
	if got := res.EnvUpdates()[SMTPFingerprintEnvKey]; got != in.SMTP.Fingerprint() {
		t.Errorf("fingerprint in .env = %q", got)
	}
	if !strings.Contains(strings.Join(c.calls, "|"), "EnsureSMTP:smtp.example.com") {
		t.Errorf("calls = %v", c.calls)
	}
}

func TestProvision_SMTPOffStillReconciles(t *testing.T) {
	c := newFakeClient()
	res, err := Provision(context.Background(), c, testInput(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.SMTP == nil || !res.SMTP.PasswordResetHidden {
		t.Errorf("SMTP outcome = %+v, want the reset link hidden", res.SMTP)
	}
	if v, ok := res.EnvUpdates()[SMTPFingerprintEnvKey]; !ok || v != "" {
		t.Errorf("fingerprint = %q (present %t), want it cleared", v, ok)
	}
}

func TestProvision_SMTPFailureIsFatalOnFreshInstallAndAWarningOnUpdate(t *testing.T) {
	c := newFakeClient()
	c.smtpErr = errors.New("forbidden")
	if _, err := Provision(context.Background(), c, testInput(), nil); err == nil || !strings.Contains(err.Error(), "smtp") {
		t.Errorf("fresh install: error = %v, want an smtp error", err)
	}

	c = newFakeClient()
	c.smtpErr = errors.New("forbidden")
	existing := map[string]string{"ALFHEIM_WEB_CLIENT_ID": "client-1", SMTPFingerprintEnvKey: "kept"}
	res, err := Provision(context.Background(), c, testInput(), existing)
	if err != nil {
		t.Fatalf("existing install: error = %v, want a warning only", err)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "SMTP") || res.SMTP != nil {
		t.Errorf("warnings = %v, SMTP = %+v", res.Warnings, res.SMTP)
	}
	if _, ok := res.EnvUpdates()[SMTPFingerprintEnvKey]; ok {
		t.Error("a failed run must keep the recorded fingerprint")
	}
}
