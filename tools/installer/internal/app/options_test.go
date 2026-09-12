package app

import (
	"bytes"
	"strings"
	"testing"

	"alfheim/installer/internal/features/tls"
)

func TestParseOptionsFlags(t *testing.T) {
	var stderr bytes.Buffer
	opts, err := ParseOptions([]string{
		"--dry-run", "--non-interactive", "--reconfigure",
		"--domain", "example.com", "--app-host", "app.example.com",
		"--tls", "cloudflare", "--api-token", "tok",
		"--admin-email", "ops@example.com", "--image-tag", "v1.2.3",
		"--install-dir", "/srv/alfheim",
	}, &stderr)
	if err != nil {
		t.Fatalf("ParseOptions() error = %v", err)
	}

	if !opts.DryRun || !opts.NonInteractive || !opts.Reconfigure {
		t.Fatalf("boolean flags were not parsed: %+v", opts)
	}
	checks := map[string]string{
		"domain": opts.Domain, "app host": opts.AppHost, "tls": opts.TLSStrategy,
		"token": opts.APIToken, "email": opts.AdminEmail, "tag": opts.ImageTag,
		"dir": opts.InstallDir,
	}
	wants := map[string]string{
		"domain": "example.com", "app host": "app.example.com", "tls": "cloudflare",
		"token": "tok", "email": "ops@example.com", "tag": "v1.2.3",
		"dir": "/srv/alfheim",
	}
	for k, want := range wants {
		if checks[k] != want {
			t.Errorf("%s = %q, want %q", k, checks[k], want)
		}
	}
}

func TestParseOptionsDefaultsInstallDirToCwd(t *testing.T) {
	t.Setenv("ALFHEIM_INSTALL_DIR", "")
	opts, err := ParseOptions(nil, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if opts.InstallDir == "" {
		t.Fatal("InstallDir must default to the working directory")
	}
}

func TestParseOptionsReadsEnvironment(t *testing.T) {
	t.Setenv("ALFHEIM_DOMAIN", "env.example.com")
	t.Setenv("ALFHEIM_TLS_STRATEGY", "hetzner")
	t.Setenv("ALFHEIM_DNS_API_TOKEN", "env-token")
	t.Setenv("ALFHEIM_INSTALL_DIR", "/srv/from-env")
	t.Setenv("ALFHEIM_IMAGE_TAG", "v9")

	opts, err := ParseOptions(nil, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if opts.Domain != "env.example.com" || opts.TLSStrategy != "hetzner" ||
		opts.APIToken != "env-token" || opts.InstallDir != "/srv/from-env" ||
		opts.ImageTag != "v9" {
		t.Fatalf("environment defaults were not applied: %+v", opts)
	}
}

func TestParseOptionsFlagsBeatEnvironment(t *testing.T) {
	t.Setenv("ALFHEIM_DOMAIN", "env.example.com")
	opts, err := ParseOptions([]string{"--domain", "flag.example.com"}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if opts.Domain != "flag.example.com" {
		t.Fatalf("Domain = %q, want the flag to win", opts.Domain)
	}
}

func TestParseOptionsAcceptsProviderTokenNames(t *testing.T) {
	t.Setenv("CLOUDFLARE_API_TOKEN", "cf-token")
	opts, err := ParseOptions(nil, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if opts.APIToken != "cf-token" {
		t.Fatalf("APIToken = %q, want the provider variable to be honoured", opts.APIToken)
	}
}

func TestParseOptionsErrors(t *testing.T) {
	tests := []struct {
		name string
		args []string
	}{
		{"unknown flag", []string{"--nope"}},
		{"stray argument", []string{"install"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var stderr bytes.Buffer
			if _, err := ParseOptions(tc.args, &stderr); err == nil {
				t.Fatal("ParseOptions() error = nil, want a usage failure")
			}
		})
	}
}

func TestParseOptionsHelpPrintsUsage(t *testing.T) {
	var stderr bytes.Buffer
	if _, err := ParseOptions([]string{"-h"}, &stderr); err == nil {
		t.Fatal("ParseOptions(-h) error = nil")
	}
	for _, want := range []string{"--dry-run", "--non-interactive", "--reconfigure", "Exit codes"} {
		if !strings.Contains(stderr.String(), want) {
			t.Errorf("usage output is missing %q", want)
		}
	}
}

func TestHeadlessConfig(t *testing.T) {
	opts := &Options{
		Domain: "example.com", AppHost: "app.example.com",
		TLSStrategy: "hetzner", APIToken: "tok", AdminEmail: "ops@example.com",
		ImageTag: "v1",
	}
	on, tlsCfg, err := opts.HeadlessConfig()
	if err != nil {
		t.Fatalf("HeadlessConfig() error = %v", err)
	}
	if on.BaseDomain != "example.com" || on.AppHost != "app.example.com" {
		t.Errorf("onboarding = %+v", on)
	}
	if !on.Secure {
		t.Error("a DNS-01 strategy must produce a secure install")
	}
	if tlsCfg.Strategy != tls.StrategyHetznerDNS || tlsCfg.APIToken != "tok" {
		t.Errorf("tls = %+v", tlsCfg)
	}
	if tlsCfg.ACMEEmail != "ops@example.com" {
		t.Error("the administrator e-mail should seed the ACME contact")
	}
}

func TestHeadlessConfigInternalIsInsecure(t *testing.T) {
	opts := &Options{Domain: "example.com", TLSStrategy: "internal"}
	on, _, err := opts.HeadlessConfig()
	if err != nil {
		t.Fatal(err)
	}
	if on.Secure {
		t.Error("the internal CA strategy must not claim a publicly trusted certificate")
	}
}

func TestHeadlessConfigCustomCertPath(t *testing.T) {
	opts := &Options{
		Domain: "example.com", TLSStrategy: "custom",
		CertPath: "/etc/letsencrypt/live/example.com",
	}
	_, tlsCfg, err := opts.HeadlessConfig()
	if err != nil {
		t.Fatal(err)
	}
	if tlsCfg.CertSource.Mode != tls.CertModeHostPath {
		t.Errorf("Mode = %q, want the host path mode", tlsCfg.CertSource.Mode)
	}
	if tlsCfg.CertSource.HostPath != "/etc/letsencrypt/live/example.com" {
		t.Errorf("HostPath = %q", tlsCfg.CertSource.HostPath)
	}
}

func TestHeadlessConfigCustomCertDefaultPath(t *testing.T) {
	opts := &Options{Domain: "example.com", TLSStrategy: "custom"}
	_, tlsCfg, err := opts.HeadlessConfig()
	if err != nil {
		t.Fatal(err)
	}
	if tlsCfg.CertSource.Mode != "" {
		t.Errorf("Mode = %q, want it left for the manager to default", tlsCfg.CertSource.Mode)
	}
}

func TestHeadlessConfigMissingInputsAreNamed(t *testing.T) {
	tests := []struct {
		name    string
		opts    *Options
		wantErr string
	}{
		{"no domain", &Options{TLSStrategy: "internal"}, "--domain"},
		{"no strategy", &Options{Domain: "example.com"}, "--tls"},
		{"bad strategy", &Options{Domain: "example.com", TLSStrategy: "acme"}, "unknown strategy"},
		{"dns without token", &Options{Domain: "example.com", TLSStrategy: "hetzner"}, "--api-token"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := tc.opts.HeadlessConfig()
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to name %q", err, tc.wantErr)
			}
		})
	}
}
