package app

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/features/onboarding"
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
