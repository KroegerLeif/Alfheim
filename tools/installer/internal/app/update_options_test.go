package app

import (
	"bytes"
	"strings"
	"testing"
)

func TestParseUpdateOptionsDefaults(t *testing.T) {
	var stderr bytes.Buffer
	opts, err := ParseUpdateOptions(nil, &stderr)
	if err != nil {
		t.Fatalf("ParseUpdateOptions() error = %v", err)
	}
	if opts.Repo != defaultUpdateRepo {
		t.Errorf("Repo = %q, want %q", opts.Repo, defaultUpdateRepo)
	}
	if opts.Version != "" {
		t.Errorf("Version = %q, want empty (resolved later from the build version)", opts.Version)
	}
	if opts.InstallDir == "" {
		t.Error("InstallDir is empty, want the current working directory")
	}
	if opts.Yes {
		t.Error("Yes = true, want the default false")
	}
}

func TestParseUpdateOptionsFlags(t *testing.T) {
	var stderr bytes.Buffer
	opts, err := ParseUpdateOptions([]string{
		"--version", "v1.4.0", "--install-dir", "/srv/alfheim", "--repo", "acme/fork", "--yes",
	}, &stderr)
	if err != nil {
		t.Fatalf("ParseUpdateOptions() error = %v", err)
	}
	if opts.Version != "v1.4.0" {
		t.Errorf("Version = %q", opts.Version)
	}
	if opts.InstallDir != "/srv/alfheim" {
		t.Errorf("InstallDir = %q", opts.InstallDir)
	}
	if opts.Repo != "acme/fork" {
		t.Errorf("Repo = %q", opts.Repo)
	}
	if !opts.Yes {
		t.Error("Yes = false, want true")
	}
}

func TestParseUpdateOptionsEnvFallback(t *testing.T) {
	t.Setenv("ALFHEIM_VERSION", "v2.0.0")
	t.Setenv("ALFHEIM_REPO", "acme/fork")
	t.Setenv("ALFHEIM_INSTALL_DIR", "/srv/alfheim")

	var stderr bytes.Buffer
	opts, err := ParseUpdateOptions(nil, &stderr)
	if err != nil {
		t.Fatalf("ParseUpdateOptions() error = %v", err)
	}
	if opts.Version != "v2.0.0" || opts.Repo != "acme/fork" || opts.InstallDir != "/srv/alfheim" {
		t.Errorf("opts = %+v, want every value from the environment", opts)
	}
}

func TestParseUpdateOptionsFlagWinsOverEnv(t *testing.T) {
	t.Setenv("ALFHEIM_VERSION", "v2.0.0")

	var stderr bytes.Buffer
	opts, err := ParseUpdateOptions([]string{"--version", "v3.0.0"}, &stderr)
	if err != nil {
		t.Fatalf("ParseUpdateOptions() error = %v", err)
	}
	if opts.Version != "v3.0.0" {
		t.Errorf("Version = %q, want the flag to win over the environment", opts.Version)
	}
}

func TestParseUpdateOptionsRejectsUnknownFlag(t *testing.T) {
	var stderr bytes.Buffer
	if _, err := ParseUpdateOptions([]string{"--nope"}, &stderr); err == nil {
		t.Fatal("ParseUpdateOptions() error = nil, want a usage failure")
	}
}

func TestParseUpdateOptionsRejectsStrayArgument(t *testing.T) {
	var stderr bytes.Buffer
	_, err := ParseUpdateOptions([]string{"extra"}, &stderr)
	if err == nil {
		t.Fatal("ParseUpdateOptions() error = nil, want a usage failure")
	}
	if !strings.Contains(stderr.String(), "Usage") {
		t.Errorf("stderr = %q, want the usage text", stderr.String())
	}
}
