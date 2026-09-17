package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

func instantSleep(context.Context, time.Duration) error { return nil }

func TestDefaultProvisioner_ReadsPATFromFile(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.ZitadelPATFile(), []byte("  pat-from-file  \n"), 0o600); err != nil {
		t.Fatal(err)
	}

	p := &DefaultProvisioner{Sleep: instantSleep}
	pat, err := p.readPAT(context.Background(), layout, nil)
	if err != nil {
		t.Fatalf("readPAT() error = %v", err)
	}
	if pat != "pat-from-file" {
		t.Errorf("pat = %q, want it trimmed", pat)
	}
}

func TestDefaultProvisioner_FallsBackToEnvPAT(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	// No PAT file at all: the wait must exhaust its timeout and fall back.
	p := &DefaultProvisioner{PATWaitTimeout: 3 * time.Millisecond, Sleep: instantSleep}

	pat, err := p.readPAT(context.Background(), layout, map[string]string{
		"ZITADEL_BOOTSTRAP_PAT": "pat-from-env",
	})
	if err != nil {
		t.Fatalf("readPAT() error = %v", err)
	}
	if pat != "pat-from-env" {
		t.Errorf("pat = %q, want the .env fallback", pat)
	}
}

func TestDefaultProvisioner_ErrorsWhenNoPATIsAvailable(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	p := &DefaultProvisioner{PATWaitTimeout: 3 * time.Millisecond, Sleep: instantSleep}

	_, err := p.readPAT(context.Background(), layout, nil)
	if err == nil || !strings.Contains(err.Error(), "bootstrap PAT") {
		t.Fatalf("readPAT() error = %v, want it to name the missing PAT", err)
	}
}

func TestDefaultProvisioner_SleepErrorPropagates(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	sentinel := context.Canceled
	p := &DefaultProvisioner{
		PATWaitTimeout: time.Hour,
		Sleep:          func(context.Context, time.Duration) error { return sentinel },
	}

	_, err := p.readPAT(context.Background(), layout, nil)
	if err != sentinel {
		t.Fatalf("readPAT() error = %v, want %v", err, sentinel)
	}
}

func TestDefaultProvisioner_BaseURLDefault(t *testing.T) {
	p := &DefaultProvisioner{}
	if got := p.baseURL(); got != "http://127.0.0.1:80" {
		t.Errorf("baseURL() = %q", got)
	}
	p.BaseURL = "http://example.invalid"
	if got := p.baseURL(); got != "http://example.invalid" {
		t.Errorf("baseURL() = %q, want the override", got)
	}
}

func TestDefaultProvisioner_Provision_PropagatesReadPATFailure(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	p := &DefaultProvisioner{PATWaitTimeout: time.Millisecond, Sleep: instantSleep}

	_, err := p.Provision(context.Background(), layout, onboarding.Config{}, nil)
	if err == nil {
		t.Fatal("Provision() error = nil, want the PAT failure to surface")
	}
}

func TestRealSleep(t *testing.T) {
	if err := realSleep(context.Background(), time.Millisecond); err != nil {
		t.Fatalf("realSleep() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := realSleep(ctx, time.Hour); err == nil {
		t.Fatal("realSleep() error = nil, want a cancelled context to return immediately")
	}
}

func TestDefaultProjectName(t *testing.T) {
	if defaultProjectName != "Alfheim" {
		t.Errorf("defaultProjectName = %q", defaultProjectName)
	}
}

func TestLayoutZitadelPATFile(t *testing.T) {
	l := paths.Layout{Root: "/srv/alfheim"}
	want := filepath.Join("/srv/alfheim", "infrastructure", "zitadel", "machinekey", "pat.txt")
	if got := l.ZitadelPATFile(); got != want {
		t.Errorf("ZitadelPATFile() = %q, want %q", got, want)
	}
}

// TestDefaultProvisioner_ReadPAT_FilePresentNowWinsOverEnv covers the update
// path immediately after a fresh install's first boot: the file exists AND
// .env already has a (stale, or just-written) copy. The file, being the
// freshest source, must win without any wait.
func TestDefaultProvisioner_ReadPAT_FilePresentNowWinsOverEnv(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.ZitadelPATFile(), []byte("pat-from-file"), 0o600); err != nil {
		t.Fatal(err)
	}

	var slept int32
	p := &DefaultProvisioner{Sleep: func(context.Context, time.Duration) error {
		atomic.AddInt32(&slept, 1)
		return nil
	}}
	pat, err := p.readPAT(context.Background(), layout, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "pat-from-env"})
	if err != nil {
		t.Fatalf("readPAT() error = %v", err)
	}
	if pat != "pat-from-file" {
		t.Errorf("pat = %q, want the file to win over .env", pat)
	}
	if slept != 0 {
		t.Errorf("slept %d times, want 0: a present file must not wait", slept)
	}
}

// TestDefaultProvisioner_ReadPAT_EnvWinsOverWaitingForFile covers the
// ordinary Day-2 update case: the machinekey volume from first init is gone
// (no file), but .env has the PAT from the original install. That must
// resolve immediately, never blocking on the 60s file-wait timeout.
func TestDefaultProvisioner_ReadPAT_EnvWinsOverWaitingForFile(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	// No PAT file at all.

	var slept int32
	p := &DefaultProvisioner{
		PATWaitTimeout: time.Hour, // would hang the test if the wait loop ran
		Sleep: func(context.Context, time.Duration) error {
			atomic.AddInt32(&slept, 1)
			return nil
		},
	}
	pat, err := p.readPAT(context.Background(), layout, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "pat-from-env"})
	if err != nil {
		t.Fatalf("readPAT() error = %v", err)
	}
	if pat != "pat-from-env" {
		t.Errorf("pat = %q, want the .env value", pat)
	}
	if slept != 0 {
		t.Errorf("slept %d times, want 0: a .env PAT must not wait for the file", slept)
	}
}

// TestDefaultProvisioner_ReadPAT_WaitsWhenNeitherIsAvailableYet is the
// fresh-install race: Zitadel's healthcheck can turn green a moment before
// the PAT file lands on disk, so with neither source available yet, readPAT
// must poll instead of failing immediately.
func TestDefaultProvisioner_ReadPAT_WaitsWhenNeitherIsAvailableYet(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}

	var attempts int32
	p := &DefaultProvisioner{
		PATWaitTimeout: time.Hour,
		Sleep: func(context.Context, time.Duration) error {
			n := atomic.AddInt32(&attempts, 1)
			if n == 2 {
				// The file "appears" during the second poll.
				_ = os.WriteFile(layout.ZitadelPATFile(), []byte("pat-appeared-late"), 0o600)
			}
			return nil
		},
	}
	pat, err := p.readPAT(context.Background(), layout, nil)
	if err != nil {
		t.Fatalf("readPAT() error = %v", err)
	}
	if pat != "pat-appeared-late" {
		t.Errorf("pat = %q, want the file once it appears", pat)
	}
	if attempts < 2 {
		t.Errorf("slept %d times, want at least 2 polls", attempts)
	}
}

// TestDefaultProvisioner_Provision_PersistsPATToEnv covers issue #452 fact
// I: once a PAT is resolved, it must be written into .env so a later run
// against an already-initialised Zitadel (whose machinekey volume may be
// gone) can still find it.
func TestDefaultProvisioner_Provision_PersistsPATToEnv(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.ZitadelPATFile(), []byte("pat-from-file"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.EnvFile(), []byte("FOO=bar\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	var devModes []any
	var redirects []string
	addr := startSecureZitadel(t, layout, "auth.example.com", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
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
				devModes = append(devModes, body["devMode"])
				for _, u := range body["redirectUris"].([]any) {
					redirects = append(redirects, u.(string))
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"appId": "app-1", "clientId": "client-1"})
			default:
				t.Errorf("unexpected request: %s", r.URL.Path)
			}
		}))

	// No BaseURL, no RootCAFile: a secure install must be reached over HTTPS
	// on the dialled listener, trusting the generated root by default.
	p := &DefaultProvisioner{TLSAddr: addr, Sleep: instantSleep}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	if _, err := p.Provision(context.Background(), layout, on, map[string]string{}); err != nil {
		t.Fatalf("Provision() error = %v", err)
	}

	vars, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if vars["ZITADEL_BOOTSTRAP_PAT"] != "pat-from-file" {
		t.Errorf("ZITADEL_BOOTSTRAP_PAT = %q, want it persisted", vars["ZITADEL_BOOTSTRAP_PAT"])
	}
	if vars["FOO"] != "bar" {
		t.Errorf("FOO = %q, want other keys left alone", vars["FOO"])
	}
	// A secure install registers HTTPS redirect URIs without Zitadel's
	// DevMode, which only exists to allow plain-HTTP redirects.
	if len(devModes) == 0 {
		t.Fatal("no OIDC application was created")
	}
	for _, dm := range devModes {
		if dm != false {
			t.Errorf("devMode = %v, want false for a secure install", dm)
		}
	}
	for _, u := range redirects {
		if !strings.HasPrefix(u, "https://") {
			t.Errorf("redirect URI %q, want HTTPS", u)
		}
	}
}

// TestDefaultProvisioner_Provision_LegacyInsecureUsesPlainHTTP keeps an
// install whose .env predates HTTPS for every strategy provisionable: its
// Caddy still serves plain HTTP, so provisioning must too.
func TestDefaultProvisioner_Provision_LegacyInsecureUsesPlainHTTP(t *testing.T) {
	var gotHost string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHost = r.Host
		http.Error(w, `{"message":"token invalid"}`, http.StatusUnauthorized)
	}))
	defer srv.Close()

	layout := paths.Layout{Root: t.TempDir()}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	p := &DefaultProvisioner{BaseURL: srv.URL, Sleep: instantSleep}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "http://alfheim.example.com", Secure: false}
	_, err := p.Provision(context.Background(), layout, on, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "pat"})
	if err == nil || !strings.Contains(err.Error(), "does not belong") {
		t.Fatalf("error = %v, want the plain-HTTP server's 401", err)
	}
	if gotHost != "auth.example.com" {
		t.Errorf("Host = %q, want the auth host", gotHost)
	}
}

func TestDefaultProvisioner_Provision_ReportsABadRootCA(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	p := &DefaultProvisioner{RootCAFile: filepath.Join(layout.Root, "missing.crt"), Sleep: instantSleep}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	_, err := p.Provision(context.Background(), layout, on, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "pat"})
	if err == nil || !strings.Contains(err.Error(), "missing.crt") {
		t.Fatalf("error = %v, want the unreadable root CA named", err)
	}
}

// TestDefaultProvisioner_Provision_SkipsPATWriteWhenUnchanged asserts the
// .env is not rewritten when the resolved PAT already matches what is on
// file, so a plain re-run does not touch .env for no reason.
func TestDefaultProvisioner_Provision_SkipsPATWriteWhenUnchanged(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.ZitadelPATFile(), []byte("same-pat"), 0o600); err != nil {
		t.Fatal(err)
	}
	envContent := "ZITADEL_BOOTSTRAP_PAT=same-pat\n"
	if err := os.WriteFile(layout.EnvFile(), []byte(envContent), 0o600); err != nil {
		t.Fatal(err)
	}
	before, err := os.Stat(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}

	// A failing (but fast, non-retried) Zitadel call after the PAT step
	// still lets us assert the .env write (or non-write) that happens
	// before it, without paying for the HTTP client's real retry backoff.
	addr := startSecureZitadel(t, layout, "auth.example.com", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"message":"not found"}`, http.StatusNotFound)
		}))
	p := &DefaultProvisioner{TLSAddr: addr, Sleep: instantSleep}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	_, _ = p.Provision(context.Background(), layout, on, map[string]string{"ZITADEL_BOOTSTRAP_PAT": "same-pat"})

	after, err := os.Stat(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if !before.ModTime().Equal(after.ModTime()) {
		t.Error(".env was rewritten even though the PAT did not change")
	}
	got, err := os.ReadFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != envContent {
		t.Errorf(".env content changed: %q", got)
	}
}

// TestDefaultProvisioner_Provision_ReportsUnauthorizedClearly covers a PAT
// left over from an earlier install (a reused/rebuilt machinekey directory
// pointing at a different Zitadel instance): the failure must name that
// specific, common cause rather than surfacing a bare HTTP 401.
func TestDefaultProvisioner_Provision_ReportsUnauthorizedClearly(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := layout.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	var attempts int32
	addr := startSecureZitadel(t, layout, "auth.example.com", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&attempts, 1)
			http.Error(w, `{"message":"token invalid or expired"}`, http.StatusUnauthorized)
		}))
	if err := os.WriteFile(layout.ZitadelPATFile(), []byte("stale-pat"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.EnvFile(), []byte("FOO=bar\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	p := &DefaultProvisioner{TLSAddr: addr, Sleep: instantSleep}
	on := onboarding.Config{AuthHost: "auth.example.com", BaseURL: "https://alfheim.example.com", Secure: true}
	_, err := p.Provision(context.Background(), layout, on, map[string]string{})
	if err == nil {
		t.Fatal("Provision() error = nil, want the 401 to surface")
	}
	if !strings.Contains(err.Error(), "does not belong to this Zitadel instance") {
		t.Errorf("error = %v, want the stale-PAT explanation", err)
	}
	if !strings.Contains(err.Error(), layout.ZitadelPATFile()) {
		t.Errorf("error = %v, want it to name the machinekey file", err)
	}
	if attempts != 1 {
		t.Errorf("attempts = %d, want exactly 1 (no retry on 401)", attempts)
	}
}
