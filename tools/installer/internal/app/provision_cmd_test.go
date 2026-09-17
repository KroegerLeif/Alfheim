package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// zitadelStub answers just enough of the Management API for RunProvision to
// reconcile a project and two OIDC applications from scratch.
func zitadelStub(t *testing.T) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	addr := startSecureZitadel(t, paths.Layout{Root: dir}, "auth.example.com", zitadelStub(t))

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
}

// TestRunProvision_LegacyInsecureEnv keeps a plain-HTTP .env provisionable
// through --zitadel-url.
func TestRunProvision_LegacyInsecureEnv(t *testing.T) {
	srv := httptest.NewServer(zitadelStub(t))
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
