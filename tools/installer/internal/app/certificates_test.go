package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/tls"
)

// stubPreflight records the hosts it was asked about.
type stubPreflight struct {
	hosts    []string
	warnings []string
	err      error
}

func (s *stubPreflight) Check(_ context.Context, _ tls.Config, hosts []string) ([]string, error) {
	s.hosts = hosts
	return s.warnings, s.err
}

// stubCertWaiter records the hosts it waited for.
type stubCertWaiter struct {
	hosts []string
	err   error
}

func (s *stubCertWaiter) Wait(_ context.Context, hosts []string) error {
	s.hosts = hosts
	return s.err
}

func dnsInstallOptions(root string) *Options {
	return &Options{
		NonInteractive: true, InstallDir: root,
		Domain: "loegien.de", AppHost: "alfheim.loegien.de",
		TLSStrategy: "desec", APIToken: "tok", AdminEmail: "ops@loegien.de",
	}
}

func TestDNSInstallWaitsForCertificatesBeforeProvisioning(t *testing.T) {
	app, stdout, _ := newTestApp(t, dnsInstallOptions(t.TempDir()), healthyDocker(), nil)
	waiter := &stubCertWaiter{}
	app.CertWaiter = waiter

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	if strings.Join(waiter.hosts, ",") != "auth.loegien.de,alfheim.loegien.de" {
		t.Fatalf("waited for %v, want the auth and app hosts", waiter.hosts)
	}
	if !strings.Contains(stdout.String(), "Phase: Certificates") {
		t.Errorf("stdout = %q, want the certificate phase", stdout.String())
	}
}

func TestCertificateTimeoutStopsBeforeProvisioning(t *testing.T) {
	root := t.TempDir()
	app, _, stderr := newTestApp(t, dnsInstallOptions(root), healthyDocker(), nil)
	app.CertWaiter = &stubCertWaiter{err: errors.New("tls: Caddy has no valid certificate for auth.loegien.de")}
	prov := &stubProvisioner{}
	app.Provisioner = prov

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "no valid certificate for auth.loegien.de") {
		t.Errorf("stderr = %q", stderr.String())
	}
	if prov.calls != 0 {
		t.Errorf("provisioning ran %d time(s) without a certificate", prov.calls)
	}
	if _, err := os.Stat(filepath.Join(root, ".alfheim.installed")); err == nil {
		t.Error("an install without a certificate must not be marked complete")
	}
}

func TestInternalStrategySkipsTheCertificateWait(t *testing.T) {
	opts := &Options{
		NonInteractive: true, InstallDir: t.TempDir(),
		Domain: "example.com", TLSStrategy: "internal", AdminEmail: "ops@example.com",
	}
	app, _, _ := newTestApp(t, opts, healthyDocker(), nil)
	waiter := &stubCertWaiter{}
	preflight := &stubPreflight{}
	app.CertWaiter, app.DNSPreflight = waiter, preflight

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d", code)
	}
	if waiter.hosts != nil || preflight.hosts != nil {
		t.Fatalf("internal strategy waited for %v / preflighted %v", waiter.hosts, preflight.hosts)
	}
}

func TestPreflightFailureStopsBeforeAnythingIsWritten(t *testing.T) {
	root := t.TempDir()
	app, _, stderr := newTestApp(t, dnsInstallOptions(root), healthyDocker(), nil)
	app.DNSPreflight = &stubPreflight{err: errors.New("tls: deSEC rejected the API token")}

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "deSEC rejected the API token") {
		t.Errorf("stderr = %q", stderr.String())
	}
	if _, err := os.Stat(filepath.Join(root, ".env")); err == nil {
		t.Error(".env was written although the preflight failed")
	}
}

func TestPreflightWarningsAreShownAndDoNotBlock(t *testing.T) {
	app, _, stderr := newTestApp(t, dnsInstallOptions(t.TempDir()), healthyDocker(), nil)
	app.DNSPreflight = &stubPreflight{warnings: []string{"_acme-challenge.auth.loegien.de holds 3 leftover TXT value(s)"}}

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d", code)
	}
	if !strings.Contains(stderr.String(), "Warning: _acme-challenge.auth.loegien.de holds 3 leftover") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestDryRunSkipsThePreflight(t *testing.T) {
	opts := dnsInstallOptions(t.TempDir())
	opts.DryRun = true
	app, _, _ := newTestApp(t, opts, healthyDocker(), nil)
	preflight := &stubPreflight{err: errors.New("must not be called")}
	app.DNSPreflight = preflight

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d", code)
	}
}

func TestReconfigureReportsADomainChange(t *testing.T) {
	root := t.TempDir()
	previous := "ZITADEL_EXTERNALDOMAIN=auth.old.example\nALFHEIM_HOST=old.example\n"
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(previous), 0o600); err != nil {
		t.Fatal(err)
	}
	opts := dnsInstallOptions(root)
	opts.Reconfigure = true
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	want := "Domain change: old.example / auth.old.example -> alfheim.loegien.de / auth.loegien.de"
	if !strings.Contains(stdout.String(), want) {
		t.Fatalf("stdout = %q, want %q", stdout.String(), want)
	}
}

func TestReconfigureWithoutDomainChangeIsQuiet(t *testing.T) {
	root := t.TempDir()
	previous := "ZITADEL_EXTERNALDOMAIN=auth.loegien.de\nALFHEIM_HOST=alfheim.loegien.de\n"
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(previous), 0o600); err != nil {
		t.Fatal(err)
	}
	opts := dnsInstallOptions(root)
	opts.Reconfigure = true
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d", code)
	}
	if strings.Contains(stdout.String(), "Domain change") {
		t.Fatalf("stdout = %q, want no domain-change notice", stdout.String())
	}
}
