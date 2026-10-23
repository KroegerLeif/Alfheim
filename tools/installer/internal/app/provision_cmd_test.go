package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// loginPolicyStub fakes the instance login policy endpoint, which starts out
// with self-registration enabled like a fresh Zitadel, and the organisation
// policy that inherits it.
type loginPolicyStub struct {
	mu           sync.Mutex
	registerOpen bool
	puts         int
}

func newLoginPolicyStub() *loginPolicyStub { return &loginPolicyStub{registerOpen: true} }

// handle answers a login policy request and reports whether it did.
func (l *loginPolicyStub) handle(w http.ResponseWriter, r *http.Request) bool {
	if handleOperatorAccess(w, r) {
		return true
	}
	if r.URL.Path != "/admin/v1/policies/login" && r.URL.Path != "/management/v1/policies/login" {
		return false
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPut && r.URL.Path == "/admin/v1/policies/login" {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		l.registerOpen, _ = body["allowRegister"].(bool)
		l.puts++
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return true
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"policy": map[string]any{
		"allowRegister": l.registerOpen, "isDefault": true,
	}})
	return true
}

// handleOperatorAccess answers the project role and grant calls that
// provisioning makes for the Grafana operator role, with a project that has
// role assertion on and a user that already holds the role.
func handleOperatorAccess(w http.ResponseWriter, r *http.Request) bool {
	var resp map[string]any
	switch {
	case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/management/v1/projects/proj-"):
		resp = map[string]any{"project": map[string]any{"name": "Alfheim", "projectRoleAssertion": true}}
	case strings.HasSuffix(r.URL.Path, "/roles/_search"):
		resp = map[string]any{"result": []map[string]any{{"key": "alfheim_operator"}}}
	case r.URL.Path == "/management/v1/users/_search":
		resp = map[string]any{"result": []map[string]any{{"id": "user-1", "userName": "admin@example.com"}}}
	case r.URL.Path == "/management/v1/users/grants/_search":
		resp = map[string]any{"result": []map[string]any{
			{"id": "grant-1", "userId": "user-1", "projectId": "proj-1", "roleKeys": []string{"alfheim_operator"}},
		}}
	default:
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
	return true
}

func (l *loginPolicyStub) registrationOpen() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.registerOpen
}

// zitadelStub answers just enough of the Management API for RunProvision to
// reconcile a project and two OIDC applications from scratch.
func zitadelStub(t *testing.T, policy *loginPolicyStub) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if policy.handle(w, r) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/projects/_search"):
			_ = json.NewEncoder(w).Encode(map[string]any{"result": []any{}})
		case r.URL.Path == "/management/v1/projects":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "proj-1"})
		case strings.HasSuffix(r.URL.Path, "/apps/_search"):
			_ = json.NewEncoder(w).Encode(map[string]any{"result": []any{}})
		case strings.HasSuffix(r.URL.Path, "/apps/oidc"):
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			resp := map[string]any{"appId": "app-1", "clientId": "web-client"}
			if body["authMethodType"] == "OIDC_AUTH_METHOD_TYPE_BASIC" {
				resp["clientId"] = "grafana-client"
				resp["clientSecret"] = "grafana-secret"
			}
			_ = json.NewEncoder(w).Encode(resp)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	})
}

// TestRunProvision_Succeeds covers scripts/up.sh's headless path against an
// internal-strategy install: HTTPS to the auth host on the dialled listener,
// trusting the generated root found next to the .env without any flag.
func TestRunProvision_Succeeds(t *testing.T) {
	dir := t.TempDir()
	policy := newLoginPolicyStub()
	addr := startSecureZitadel(t, paths.Layout{Root: dir}, "auth.example.com", zitadelStub(t, policy))

	envPath := writeProvisionEnv(t, dir, "true")
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("test-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", patPath, "--zitadel-tls-addr", addr,
	}, &stdout, &stderr)
	if code != ExitOK {
		t.Fatalf("RunProvision() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	assertProvisionedEnv(t, envPath)
	if policy.registrationOpen() {
		t.Error("self-registration is still enabled after RunProvision")
	}
}

// TestRunProvision_LegacyInsecureEnv keeps a plain-HTTP .env provisionable
// through --zitadel-url.
func TestRunProvision_LegacyInsecureEnv(t *testing.T) {
	policy := newLoginPolicyStub()
	srv := httptest.NewServer(zitadelStub(t, policy))
	defer srv.Close()

	dir := t.TempDir()
	envPath := writeProvisionEnv(t, dir, "false")
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("test-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", patPath, "--zitadel-url", srv.URL,
	}, &stdout, &stderr)
	if code != ExitOK {
		t.Fatalf("RunProvision() = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	assertProvisionedEnv(t, envPath)
	if policy.registrationOpen() {
		t.Error("self-registration is still enabled after RunProvision")
	}
}

func TestRunProvision_BadCAFile(t *testing.T) {
	dir := t.TempDir()
	envPath := writeProvisionEnv(t, dir, "true")
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("test-pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", patPath, "--ca-file", filepath.Join(dir, "nope.crt"),
	}, &stdout, &stderr)
	if code != ExitFailure || !strings.Contains(stderr.String(), "nope.crt") {
		t.Fatalf("RunProvision() = %d, stderr=%s; want a failure naming the CA file", code, stderr.String())
	}
}

func writeProvisionEnv(t *testing.T, dir, secure string) string {
	t.Helper()
	scheme := "https"
	if secure != "true" {
		scheme = "http"
	}
	envPath := filepath.Join(dir, ".env")
	if err := os.WriteFile(envPath, []byte(
		"ZITADEL_EXTERNALDOMAIN=auth.example.com\nALFHEIM_BASE_URL="+scheme+"://alfheim.example.com\n"+
			"ZITADEL_EXTERNALSECURE="+secure+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return envPath
}

func assertProvisionedEnv(t *testing.T, envPath string) {
	t.Helper()
	vars, err := envfile.ParseFile(envPath)
	if err != nil {
		t.Fatal(err)
	}
	if vars["ZITADEL_PROJECT_ID"] != "proj-1" {
		t.Errorf("ZITADEL_PROJECT_ID = %q", vars["ZITADEL_PROJECT_ID"])
	}
	if vars["OIDC_AUDIENCE"] != "proj-1" {
		t.Errorf("OIDC_AUDIENCE = %q, want the project id", vars["OIDC_AUDIENCE"])
	}
	if vars["GRAFANA_OIDC_CLIENT_SECRET"] != "grafana-secret" {
		t.Errorf("GRAFANA_OIDC_CLIENT_SECRET = %q", vars["GRAFANA_OIDC_CLIENT_SECRET"])
	}
}

func TestRunProvision_RequiresBothFlags(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{"--env-file", "/tmp/x"}, &stdout, &stderr)
	if code != ExitUsage {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitUsage)
	}
	if !strings.Contains(stderr.String(), "--pat-file") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestRunProvision_RejectsUnknownFlag(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{"--nope"}, &stdout, &stderr)
	if code != ExitUsage {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitUsage)
	}
}

func TestRunProvision_RejectsStrayArgument(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", "/tmp/x", "--pat-file", "/tmp/y", "extra",
	}, &stdout, &stderr)
	if code != ExitUsage {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitUsage)
	}
}

func TestRunProvision_MissingEnvFile(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", "/does/not/exist", "--pat-file", "/does/not/exist",
	}, &stdout, &stderr)
	if code != ExitFailure {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitFailure)
	}
}

func TestRunProvision_EnvMissingRequiredKeys(t *testing.T) {
	dir := t.TempDir()
	envPath := filepath.Join(dir, ".env")
	if err := os.WriteFile(envPath, []byte("FOO=bar\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("pat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{"--env-file", envPath, "--pat-file", patPath}, &stdout, &stderr)
	if code != ExitFailure {
		t.Fatalf("RunProvision() = %d, want %d; stderr=%s", code, ExitFailure, stderr.String())
	}
	if !strings.Contains(stderr.String(), "ZITADEL_EXTERNALDOMAIN") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestRunProvision_EmptyPATFile(t *testing.T) {
	dir := t.TempDir()
	envPath := filepath.Join(dir, ".env")
	if err := os.WriteFile(envPath, []byte(
		"ZITADEL_EXTERNALDOMAIN=auth.example.com\nALFHEIM_BASE_URL=https://alfheim.example.com\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	patPath := filepath.Join(dir, "pat.txt")
	if err := os.WriteFile(patPath, []byte("   \n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{"--env-file", envPath, "--pat-file", patPath}, &stdout, &stderr)
	if code != ExitFailure {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "is empty") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestRunProvision_MissingPATFile(t *testing.T) {
	dir := t.TempDir()
	envPath := filepath.Join(dir, ".env")
	if err := os.WriteFile(envPath, []byte(
		"ZITADEL_EXTERNALDOMAIN=auth.example.com\nALFHEIM_BASE_URL=https://alfheim.example.com\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	code := RunProvision([]string{
		"--env-file", envPath, "--pat-file", filepath.Join(dir, "missing.txt"),
	}, &stdout, &stderr)
	if code != ExitFailure {
		t.Fatalf("RunProvision() = %d, want %d", code, ExitFailure)
	}
}
