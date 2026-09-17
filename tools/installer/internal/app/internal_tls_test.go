package app

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

func internalInstallOptions(root string) *Options {
	return &Options{
		NonInteractive: true, InstallDir: root,
		Domain: "alfheim.example.com", TLSStrategy: "internal", AdminEmail: "ops@example.com",
	}
}

// TestRunInternalInstallServesHTTPSWithAGeneratedRoot is the end-to-end view
// of the reported bug: a fresh --tls internal install on a real hostname
// must come out HTTPS, with the root CA Caddy and the backends need on disk
// and the operator told how to trust it.
func TestRunInternalInstallServesHTTPSWithAGeneratedRoot(t *testing.T) {
	root := t.TempDir()
	rec := healthyDocker()
	app, stdout, stderr := newTestApp(t, internalInstallOptions(root), rec, nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}

	layout := paths.Layout{Root: root}
	vars, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if vars["ALFHEIM_BASE_URL"] != "https://alfheim.example.com" ||
		vars["OIDC_ISSUER_URL"] != "https://auth.alfheim.example.com" ||
		vars["ZITADEL_EXTERNALSECURE"] != "true" {
		t.Errorf("URLs = %q / %q, secure = %q; want HTTPS",
			vars["ALFHEIM_BASE_URL"], vars["OIDC_ISSUER_URL"], vars["ZITADEL_EXTERNALSECURE"])
	}
	if vars["ALFHEIM_EXTRA_CA_FILE"] != tls.LocalCAContainerTrustFile {
		t.Errorf("ALFHEIM_EXTRA_CA_FILE = %q", vars["ALFHEIM_EXTRA_CA_FILE"])
	}

	info, err := os.Stat(layout.CaddyPKIRootKey())
	if err != nil {
		t.Fatalf("the root CA key was not generated: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("root key mode = %04o, want 0600", info.Mode().Perm())
	}
	if _, err := os.Stat(layout.TrustedCARootCert()); err != nil {
		t.Fatalf("the public root copy was not written: %v", err)
	}

	ca, err := tls.EnsureLocalCA(layout, "", app.now())
	if err != nil {
		t.Fatal(err)
	}
	out := stdout.String()
	for _, want := range []string{
		"Generated local root CA",
		layout.TrustedCARootCert(),
		ca.Fingerprint,
		"trust store",
		"covers every Alfheim host",
		"Keychain Access",
		"certmgr.msc",
		"Firefox",
		"BOTH",
		"      https://alfheim.example.com\n",
		"      https://auth.alfheim.example.com\n",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("stdout is missing %q:\n%s", want, out)
		}
	}
	// A fresh install starts Caddy with the new Caddyfile already, so it
	// needs no extra restart.
	for _, c := range rec.CallStrings() {
		if strings.HasSuffix(c, " restart caddy") {
			t.Errorf("a fresh install restarted caddy: %s", c)
		}
	}
}

func TestRunPublicStrategyCreatesNoRootCA(t *testing.T) {
	root := t.TempDir()
	writeCustomCerts(t, root)
	opts := internalInstallOptions(root)
	opts.TLSStrategy = "custom"
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	layout := paths.Layout{Root: root}
	if _, err := os.Stat(layout.CaddyPKIRootKey()); err == nil {
		t.Error("a publicly trusted strategy must not generate a root CA")
	}
	if strings.Contains(stdout.String(), "SHA-256") {
		t.Errorf("stdout mentions a root CA for the custom strategy:\n%s", stdout.String())
	}
	vars, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if v, ok := vars["ALFHEIM_EXTRA_CA_FILE"]; !ok || v != "" {
		t.Errorf("ALFHEIM_EXTRA_CA_FILE = %q (present %t), want present and empty", v, ok)
	}
}

func TestRunDryRunKeepsTheRootCAOutOfTheInstallRoot(t *testing.T) {
	root := t.TempDir()
	opts := internalInstallOptions(root)
	opts.DryRun = true
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	if _, err := os.Stat(paths.Layout{Root: root}.CaddyPKIDir()); err == nil {
		t.Error("a dry run must not create the PKI directory in the installation root")
	}
	target := filepath.Dir(dryRunTargetFromStdout(t, stdout.String()))
	if _, err := os.Stat(paths.Layout{Root: target}.CaddyPKIRootCert()); err != nil {
		t.Errorf("the dry run did not render a root CA next to its .env: %v", err)
	}
}

// TestReconfigureMigratesAPlainHTTPInternalInstall covers Day-2: an install
// rendered while --tls internal still meant plain HTTP is moved to HTTPS by
// --reconfigure, keeps its root CA across later runs, restarts Caddy so the
// regenerated Caddyfile is live, and re-provisions Zitadel.
func TestReconfigureMigratesAPlainHTTPInternalInstall(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	legacy := "ZITADEL_MASTERKEY=0123456789abcdef0123456789abcdef\n" +
		"ZITADEL_EXTERNALSECURE=false\nZITADEL_EXTERNALPORT=80\n" +
		"ALFHEIM_BASE_URL=http://alfheim.example.com\nALFHEIM_TLS_STRATEGY=internal\n" +
		"ALFHEIM_WEB_CLIENT_ID=web-client-1\n"
	if err := os.WriteFile(layout.EnvFile(), []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.Marker(), []byte("version=v1\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	opts := internalInstallOptions(root)
	opts.Reconfigure = true
	rec := healthyDocker()
	prov := &stubProvisioner{}
	app, stdout, stderr := newTestApp(t, opts, rec, nil)
	app.Provisioner = prov

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}

	vars, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if vars["ZITADEL_EXTERNALSECURE"] != "true" || vars["ALFHEIM_BASE_URL"] != "https://alfheim.example.com" {
		t.Errorf("secure = %q, base URL = %q; want the install migrated to HTTPS",
			vars["ZITADEL_EXTERNALSECURE"], vars["ALFHEIM_BASE_URL"])
	}
	if vars["ZITADEL_MASTERKEY"] != "0123456789abcdef0123456789abcdef" {
		t.Error("the masterkey must survive the migration")
	}
	caddyfile, err := os.ReadFile(layout.Caddyfile())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(caddyfile), "https://alfheim.example.com {") {
		t.Error("the regenerated Caddyfile does not serve HTTPS")
	}
	if _, err := os.Stat(layout.CaddyPKIRootCert()); err != nil {
		t.Errorf("the root CA was not created during the migration: %v", err)
	}
	if prov.calls != 1 {
		t.Errorf("provisioning ran %d times, want once so redirect URIs become https", prov.calls)
	}

	calls := rec.CallStrings()
	compose := "docker compose -f " + layout.ComposeFile()
	edge := indexOfString(calls, compose+" up -d postgres-core caddy zitadel")
	restart := indexOfString(calls, compose+" restart caddy")
	core := indexOfString(calls, compose+" up -d")
	if edge < 0 || restart < edge || core < restart {
		t.Errorf("calls = %v, want edge phase, caddy restart, then the core stack", calls)
	}

	// A second reconfigure reuses the same root.
	first, err := os.ReadFile(layout.CaddyPKIRootKey())
	if err != nil {
		t.Fatal(err)
	}
	again, stdout2, _ := newTestApp(t, internalReconfigure(root), healthyDocker(), nil)
	if code := again.Run(context.Background()); code != ExitOK {
		t.Fatalf("second reconfigure exit code = %d; stdout=%s", code, stdout2.String())
	}
	second, err := os.ReadFile(layout.CaddyPKIRootKey())
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != string(second) || !strings.Contains(stdout2.String(), "Reusing local root CA") {
		t.Error("a reconfigure rotated the root CA")
	}
}

func internalReconfigure(root string) *Options {
	opts := internalInstallOptions(root)
	opts.Reconfigure = true
	return opts
}

func TestRunRefusesAHalfPresentRootCA(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := os.MkdirAll(layout.CaddyPKIDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.CaddyPKIRootCert(), []byte("orphan"), 0o644); err != nil {
		t.Fatal(err)
	}
	app, _, stderr := newTestApp(t, internalInstallOptions(root), healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "only one half") {
		t.Errorf("stderr = %q, want the half-present root explained", stderr.String())
	}
}

func TestRunReconfigureRestartFailureIsReported(t *testing.T) {
	root := t.TempDir()
	layout := paths.Layout{Root: root}
	if err := os.WriteFile(layout.EnvFile(), []byte("DOMAIN=alfheim.example.com\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(layout.Marker(), []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := healthyDocker()
	rec.ScriptResult("docker compose -f "+layout.ComposeFile()+" restart caddy",
		runner.Result{ExitCode: 1, Stderr: "caddy exploded"})
	app, _, stderr := newTestApp(t, internalReconfigure(root), rec, nil)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "caddy exploded") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestUpdateWarnsAboutAPlainHTTPInstall(t *testing.T) {
	for _, tc := range []struct {
		name     string
		env      string
		wantWarn bool
	}{
		{"legacy internal", "DOMAIN=example.com\nZITADEL_EXTERNALSECURE=false\nALFHEIM_TLS_STRATEGY=internal\n", true},
		{"unset", "DOMAIN=example.com\n", true},
		{"https", "DOMAIN=example.com\nZITADEL_EXTERNALSECURE=true\nALFHEIM_TLS_STRATEGY=internal\n", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			layout := paths.Layout{Root: root}
			if err := os.WriteFile(layout.EnvFile(), []byte(tc.env), 0o600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(layout.Marker(), []byte("v1"), 0o644); err != nil {
				t.Fatal(err)
			}
			app, _, stderr := newTestApp(t, &Options{InstallDir: root}, healthyDocker(), nil)
			if code := app.Run(context.Background()); code != ExitOK {
				t.Fatalf("exit code = %d; stderr=%s", code, stderr.String())
			}
			warned := strings.Contains(stderr.String(), "alfheim-setup --reconfigure")
			if warned != tc.wantWarn {
				t.Errorf("warned = %t, want %t; stderr=%s", warned, tc.wantWarn, stderr.String())
			}
		})
	}
}

func indexOfString(haystack []string, needle string) int {
	for i, s := range haystack {
		if s == needle {
			return i
		}
	}
	return -1
}
