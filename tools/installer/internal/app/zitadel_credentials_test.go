package app

import (
	"bytes"
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/zitadelauth"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// assertOwnerOnlyKey checks that a machine key is stored with mode 0600 and
// parses.
func assertOwnerOnlyKey(t *testing.T, layout paths.Layout) zitadelauth.Key {
	t.Helper()
	info, err := os.Stat(layout.ZitadelProvisionerKeyFile())
	if err != nil {
		t.Fatalf("machine key not stored: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("machine key mode = %04o, want 0600", info.Mode().Perm())
	}
	key, found, err := zitadelauth.LoadKey(layout.ZitadelProvisionerKeyFile())
	if err != nil || !found {
		t.Fatalf("LoadKey() = %v, %v", found, err)
	}
	return key
}

// provisionAgainstStub runs DefaultProvisioner once against a stub Zitadel
// that shares policy (and so its credential state) across runs.
func provisionAgainstStub(
	t *testing.T, layout paths.Layout, policy *loginPolicyStub, addr string, existing map[string]string,
) error {
	t.Helper()
	p := &DefaultProvisioner{TLSAddr: addr, Sleep: instantSleep, PATWaitTimeout: time.Millisecond}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	_, err := p.Provision(context.Background(), layout, on, existing)
	return err
}

func newStubInstall(t *testing.T, env string) (paths.Layout, *loginPolicyStub, string) {
	t.Helper()
	layout := paths.Layout{Root: t.TempDir()}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.EnvFile(), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	policy := newLoginPolicyStub()
	addr := startSecureZitadel(t, layout, "auth.example.com", zitadelStub(t, policy))
	return layout, policy, addr
}

// TestProvision_MigratesLongLivedPATFromEnv covers an install upgraded with
// `alfheim-setup update`: its only credential is the PAT in .env, which is
// used once and then revoked and cleared.
func TestProvision_MigratesLongLivedPATFromEnv(t *testing.T) {
	layout, policy, addr := newStubInstall(t, "FOO=bar\nZITADEL_BOOTSTRAP_PAT=old-pat\n")

	err := provisionAgainstStub(t, layout, policy, addr, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "old-pat"})
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	vars, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if vars["ZITADEL_BOOTSTRAP_PAT"] != "" || vars["FOO"] != "bar" {
		t.Errorf(".env = %v, want the PAT cleared and other keys kept", vars)
	}
	key := assertOwnerOnlyKey(t, layout)
	keys, pats := policy.creds.state()
	if len(pats) != 0 || len(keys) != 1 || keys[0] != key.KeyID {
		t.Errorf("Zitadel holds keys %v and PATs %v, want only the stored key %s", keys, pats, key.KeyID)
	}
}

// TestProvision_RotatesStoredKeyWithoutAnyPAT is every run after the
// migration: no PAT exists anywhere, and the key is replaced each time.
func TestProvision_RotatesStoredKeyWithoutAnyPAT(t *testing.T) {
	layout, policy, addr := newStubInstall(t, "ZITADEL_BOOTSTRAP_PAT=old-pat\n")
	if err := provisionAgainstStub(t, layout, policy, addr, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "old-pat"}); err != nil {
		t.Fatalf("first Provision() error = %v", err)
	}
	first := assertOwnerOnlyKey(t, layout)

	for run := 0; run < 2; run++ {
		if err := provisionAgainstStub(t, layout, policy, addr, map[string]string{}); err != nil {
			t.Fatalf("Provision() run %d error = %v", run, err)
		}
	}
	latest := assertOwnerOnlyKey(t, layout)
	if latest.KeyID == first.KeyID {
		t.Error("the stored key was not rotated")
	}
	keys, pats := policy.creds.state()
	if len(pats) != 0 || len(keys) != 1 || keys[0] != latest.KeyID {
		t.Errorf("Zitadel holds keys %v and PATs %v, want only %s", keys, pats, latest.KeyID)
	}
}

// TestProvision_RejectedKeyFallsBackToPAT covers a key from an earlier
// installation (or one that expired): a PAT supplied for recovery wins and
// replaces the key.
func TestProvision_RejectedKeyFallsBackToPAT(t *testing.T) {
	layout, _, addr := newStubInstall(t, "ZITADEL_BOOTSTRAP_PAT=recovery-pat\n")
	if err := zitadelauth.WriteKey(layout.ZitadelProvisionerKeyFile(), stubKeyJSON("foreign-key")); err != nil {
		t.Fatal(err)
	}

	p := &DefaultProvisioner{TLSAddr: addr, Sleep: instantSleep, PATWaitTimeout: time.Millisecond}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	result, err := p.Provision(context.Background(), layout, on, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "recovery-pat"})
	if err != nil {
		t.Fatalf("Provision() error = %v", err)
	}
	if key := assertOwnerOnlyKey(t, layout); key.KeyID == "foreign-key" {
		t.Error("the rejected key was kept")
	}
	if len(result.Warnings) == 0 || !strings.Contains(result.Warnings[0], "rejected the stored machine key") {
		t.Errorf("warnings = %v, want the rejected key reported", result.Warnings)
	}
}

// TestProvision_RejectedKeyWithoutPATFails names both missing credentials.
func TestProvision_RejectedKeyWithoutPATFails(t *testing.T) {
	layout, policy, addr := newStubInstall(t, "FOO=bar\n")
	if err := zitadelauth.WriteKey(layout.ZitadelProvisionerKeyFile(), stubKeyJSON("expired-key")); err != nil {
		t.Fatal(err)
	}
	err := provisionAgainstStub(t, layout, policy, addr, map[string]string{})
	if err == nil || !strings.Contains(err.Error(), "was rejected and no bootstrap PAT") {
		t.Fatalf("Provision() error = %v, want the recovery hint", err)
	}
}

// TestRunProvision_UsesStoredKeyWithoutPATFile is scripts/up.sh after the
// migration: `provision` runs without --pat-file.
func TestRunProvision_UsesStoredKeyWithoutPATFile(t *testing.T) {
	dir := t.TempDir()
	policy := newLoginPolicyStub()
	addr := startSecureZitadel(t, paths.Layout{Root: dir}, "auth.example.com", zitadelStub(t, policy))
	envPath := writeProvisionEnv(t, dir, "true")

	var stdout, stderr bytes.Buffer
	args := []string{"--env-file", envPath, "--zitadel-tls-addr", addr}
	if code := RunProvision(args, &stdout, &stderr); code != ExitFailure ||
		!strings.Contains(stderr.String(), "no --pat-file given") {
		t.Fatalf("RunProvision() without key or PAT = %d; stderr=%s", code, stderr.String())
	}

	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("first-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stderr.Reset()
	if code := RunProvision(append(args, "--pat-file", patPath), &stdout, &stderr); code != ExitOK {
		t.Fatalf("RunProvision() with PAT = %d; stderr=%s", code, stderr.String())
	}
	stderr.Reset()
	if code := RunProvision(args, &stdout, &stderr); code != ExitOK {
		t.Fatalf("RunProvision() with the stored key = %d; stderr=%s", code, stderr.String())
	}
	assertOwnerOnlyKey(t, paths.Layout{Root: dir})
}

// TestRetireBootstrapPAT_WarnsWhenFileCannotBeDeleted keeps provisioning
// going when Zitadel's PAT file is out of reach, since it is already revoked.
func TestRetireBootstrapPAT_WarnsWhenFileCannotBeDeleted(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	// A non-empty directory where the file should be makes os.Remove fail.
	if err := os.MkdirAll(filepath.Join(layout.ZitadelPATFile(), "child"), 0o700); err != nil {
		t.Fatal(err)
	}
	warnings, err := retireBootstrapPAT(layout, map[string]string{})
	if err != nil {
		t.Fatalf("retireBootstrapPAT() error = %v", err)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "revoked") {
		t.Errorf("warnings = %v", warnings)
	}
}

// TestRetireBootstrapPAT_FailsWhenEnvCannotBeCleared refuses to report
// success while .env still holds the PAT.
func TestRetireBootstrapPAT_FailsWhenEnvCannotBeCleared(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	_, err := retireBootstrapPAT(layout, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "pat"})
	if err == nil || !strings.Contains(err.Error(), "ZITADEL_BOOTSTRAP_PAT") {
		t.Fatalf("retireBootstrapPAT() error = %v", err)
	}
}

// TestRunZitadelToken prints a token from the stored key and fails clearly
// without one.
func TestRunZitadelToken(t *testing.T) {
	dir := t.TempDir()
	policy := newLoginPolicyStub()
	addr := startSecureZitadel(t, paths.Layout{Root: dir}, "auth.example.com", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			if !policy.creds.handle(w, r) {
				t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
			}
		}))
	envPath := writeProvisionEnv(t, dir, "true")
	args := []string{"--env-file", envPath, "--zitadel-tls-addr", addr}

	var stdout, stderr bytes.Buffer
	if code := RunZitadelToken(args, &stdout, &stderr); code != ExitFailure ||
		!strings.Contains(stderr.String(), "no Zitadel machine key") {
		t.Fatalf("RunZitadelToken() without key = %d; stderr=%s", code, stderr.String())
	}

	policy.creds.keys["key-9"] = true
	layout := paths.Layout{Root: dir}
	if err := zitadelauth.WriteKey(layout.ZitadelProvisionerKeyFile(), stubKeyJSON("key-9")); err != nil {
		t.Fatal(err)
	}
	stderr.Reset()
	if code := RunZitadelToken(args, &stdout, &stderr); code != ExitOK {
		t.Fatalf("RunZitadelToken() = %d; stderr=%s", code, stderr.String())
	}
	if strings.TrimSpace(stdout.String()) != "token-for-key-9" {
		t.Errorf("stdout = %q, want the access token", stdout.String())
	}
}

func TestRunZitadelToken_UsageAndEnvErrors(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := RunZitadelToken(nil, &stdout, &stderr); code != ExitUsage {
		t.Errorf("no flags = %d, want %d", code, ExitUsage)
	}
	if code := RunZitadelToken([]string{"--bogus"}, &stdout, &stderr); code != ExitUsage {
		t.Errorf("unknown flag = %d, want %d", code, ExitUsage)
	}
	if code := RunZitadelToken([]string{"--env-file", "/does/not/exist"}, &stdout, &stderr); code != ExitFailure {
		t.Errorf("missing .env = %d, want %d", code, ExitFailure)
	}
	envPath := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(envPath, []byte("FOO=bar\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if code := RunZitadelToken([]string{"--env-file", envPath}, &stdout, &stderr); code != ExitFailure {
		t.Errorf("incomplete .env = %d, want %d", code, ExitFailure)
	}
}

func TestZitadelIssuer(t *testing.T) {
	cases := []struct {
		secure bool
		port   string
		want   string
	}{
		{true, "", "https://auth.example.com"},
		{true, "443", "https://auth.example.com"},
		{false, "80", "http://auth.example.com"},
		{true, "8443", "https://auth.example.com:8443"},
		{false, "8080", "http://auth.example.com:8080"},
	}
	for _, tc := range cases {
		if got := zitadelIssuer("auth.example.com", tc.secure, tc.port); got != tc.want {
			t.Errorf("zitadelIssuer(%v, %q) = %q, want %q", tc.secure, tc.port, got, tc.want)
		}
	}
}
