package app

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/runner"
	"alfheim/installer/internal/shared/system"
)

// stubInspector reports a ready host without touching the build machine. The
// real inspector binds ports 80 and 443 to probe them, which is not available
// on a shared CI runner and is not what these tests are exercising.
type stubInspector struct {
	report system.Report
	err    error
}

func (s stubInspector) Inspect(context.Context) (system.Report, error) {
	return s.report, s.err
}

// unpreparedHost is the inspection outcome of a machine without Docker.
func unpreparedHost() stubInspector {
	return stubInspector{report: system.Report{OS: "linux", Arch: "amd64"}}
}

// readyHost is the inspection outcome of a machine that can run an install.
func readyHost() stubInspector {
	return stubInspector{report: system.Report{
		DockerInstalled: true,
		DaemonRunning:   true,
		ComposeV2:       true,
		ComposeVersion:  "2.29.0",
		Port80Free:      true,
		Port443Free:     true,
		OS:              "linux",
		Arch:            "amd64",
	}}
}

// stubWizard answers the forms without a terminal.
type stubWizard struct {
	on         onboarding.Config
	tls        tls.Config
	runErr     error
	confirmErr error
	confirmed  bool
}

func (s *stubWizard) Run(on *onboarding.Config, tlsCfg *tls.Config) error {
	if s.runErr != nil {
		return s.runErr
	}
	*on = s.on
	*tlsCfg = s.tls
	return nil
}

func (s *stubWizard) Confirm(context.Context, string) error {
	s.confirmed = true
	return s.confirmErr
}

// healthyDocker scripts a host and stack where everything succeeds.
func healthyDocker() *runner.RecordingRunner {
	rec := runner.NewRecording(map[string]runner.Result{
		"docker info --format {{.ServerVersion}}": {ExitCode: 0, Stdout: "27.0.1\n"},
		"docker compose version --short":          {ExitCode: 0, Stdout: "2.29.1\n"},
	})
	rec.Fallback = runner.Result{ExitCode: 0, Stdout: "running|healthy\n"}
	return rec
}

func newTestApp(t *testing.T, opts *Options, rec runner.Runner, wiz Wizard) (*App, *bytes.Buffer, *bytes.Buffer) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	return &App{
		Options:   opts,
		Build:     BuildInfo{Version: "v1.0.0-test", Commit: "abc123", Date: "2026-03-01"},
		Runner:    rec,
		Wizard:    wiz,
		Stdout:    &stdout,
		Stderr:    &stderr,
		Now:       func() time.Time { return time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC) },
		Inspector: readyHost(),
	}, &stdout, &stderr
}

func TestRunVersion(t *testing.T) {
	app, stdout, _ := newTestApp(t, &Options{ShowVersion: true}, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d, want %d", code, ExitOK)
	}
	if !strings.Contains(stdout.String(), "v1.0.0-test") {
		t.Fatalf("stdout = %q, want the version", stdout.String())
	}
}

func TestBuildInfoFallsBackToDev(t *testing.T) {
	if got := (BuildInfo{}).String(); !strings.Contains(got, "dev") {
		t.Fatalf("BuildInfo{} = %q, want a dev fallback", got)
	}
}

func TestRunHeadlessDryRunWritesElsewhere(t *testing.T) {
	root := t.TempDir()
	opts := &Options{
		DryRun: true, NonInteractive: true, InstallDir: root,
		Domain: "example.com", TLSStrategy: "internal",
	}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d, want %d; stdout=%s", code, ExitOK, stdout.String())
	}
	// A dry run must not touch the installation root.
	if _, err := os.Stat(filepath.Join(root, ".env")); err == nil {
		t.Fatal("a dry run must not write into the installation root")
	}
	if !strings.Contains(stdout.String(), "Dry run complete") {
		t.Fatalf("stdout = %q", stdout.String())
	}
}

func TestRunHeadlessFullInstall(t *testing.T) {
	root := t.TempDir()
	opts := &Options{
		NonInteractive: true, InstallDir: root,
		Domain: "example.com", TLSStrategy: "internal", AdminEmail: "ops@example.com",
	}
	rec := healthyDocker()
	app, stdout, _ := newTestApp(t, opts, rec, nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}

	// The generated files must land in the installation root.
	vars, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatalf("the .env was not written: %v", err)
	}
	if len(vars["ZITADEL_MASTERKEY"]) != 32 {
		t.Errorf("masterkey = %q, want 32 characters", vars["ZITADEL_MASTERKEY"])
	}
	if _, err := os.Stat(filepath.Join(root, "infrastructure", "caddy", "Caddyfile")); err != nil {
		t.Errorf("the Caddyfile was not written: %v", err)
	}
	// The completion marker turns the next run into a Day-2 update.
	if _, err := os.Stat(filepath.Join(root, ".alfheim.installed")); err != nil {
		t.Errorf("the installation marker was not written: %v", err)
	}

	calls := rec.CallStrings()
	compose := filepath.Join(root, "compose.prod.yaml")
	if !containsString(calls, "docker compose -f "+compose+" up -d postgres-core caddy zitadel") {
		t.Errorf("phase 1 was not started; calls = %v", calls)
	}
	if !containsString(calls, "docker compose -f "+compose+" up -d") {
		t.Errorf("phase 2 was not started; calls = %v", calls)
	}
}

func TestRunInteractiveUsesTheWizard(t *testing.T) {
	root := t.TempDir()
	wiz := &stubWizard{
		on:  onboarding.Config{Preset: onboarding.PresetCustom, BaseDomain: "wizard.example.com"},
		tls: tls.Config{Strategy: tls.StrategyInternal},
	}
	app, stdout, _ := newTestApp(t, &Options{InstallDir: root}, healthyDocker(), wiz)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	if !wiz.confirmed {
		t.Error("the interactive run must pause for the Zitadel onboarding step")
	}

	vars, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if vars["DOMAIN"] != "wizard.example.com" {
		t.Errorf("DOMAIN = %q, want the wizard answer", vars["DOMAIN"])
	}
}

func TestRunWizardFailureIsReported(t *testing.T) {
	wiz := &stubWizard{runErr: errors.New("form aborted")}
	app, _, stderr := newTestApp(t, &Options{InstallDir: t.TempDir()}, healthyDocker(), wiz)

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "form aborted") {
		t.Fatalf("stderr = %q", stderr.String())
	}
}

func TestRunInterruptReturns130(t *testing.T) {
	wiz := &stubWizard{
		on:         onboarding.Config{Preset: onboarding.PresetCustom, BaseDomain: "example.com"},
		tls:        tls.Config{Strategy: tls.StrategyInternal},
		confirmErr: context.Canceled,
	}
	app, _, stderr := newTestApp(t, &Options{InstallDir: t.TempDir()}, healthyDocker(), wiz)

	if code := app.Run(context.Background()); code != ExitInterrupt {
		t.Fatalf("exit code = %d, want %d", code, ExitInterrupt)
	}
	if !strings.Contains(stderr.String(), "left running") {
		t.Fatalf("stderr = %q, want reassurance that containers survive", stderr.String())
	}
}

func TestRunRefusesAnUnpreparedHost(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.StrictLookPath = true // Docker is absent.

	opts := &Options{NonInteractive: true, InstallDir: t.TempDir(),
		Domain: "example.com", TLSStrategy: "internal"}
	app, _, stderr := newTestApp(t, opts, rec, nil)
	// The point of this test: an install must refuse on a host it cannot use.
	app.Inspector = unpreparedHost()

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "not ready") {
		t.Fatalf("stderr = %q", stderr.String())
	}
}

func TestDryRunToleratesAnUnpreparedHost(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.StrictLookPath = true

	opts := &Options{DryRun: true, NonInteractive: true, InstallDir: t.TempDir(),
		Domain: "example.com", TLSStrategy: "internal"}
	app, stdout, stderr := newTestApp(t, opts, rec, nil)
	// The point of this test: a host that cannot run an install must still
	// render configuration during a dry run.
	app.Inspector = unpreparedHost()

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d, want %d; stderr=%s", code, ExitOK, stderr.String())
	}
	if !strings.Contains(stderr.String(), "dry run") {
		t.Errorf("stderr = %q, want an explanation", stderr.String())
	}
	if !strings.Contains(stdout.String(), "Dry run complete") {
		t.Errorf("stdout = %q", stdout.String())
	}
}

func TestRunUpdateModeSkipsTheWizard(t *testing.T) {
	root := t.TempDir()
	// An existing installation.
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("DOMAIN=old.example.com\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".alfheim.installed"), []byte("version=v1\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	wiz := &stubWizard{runErr: errors.New("the wizard must not run during an update")}
	rec := healthyDocker()
	app, stdout, _ := newTestApp(t, &Options{InstallDir: root}, rec, wiz)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}
	if !strings.Contains(stdout.String(), "existing installation") {
		t.Errorf("stdout = %q", stdout.String())
	}
	compose := filepath.Join(root, "compose.prod.yaml")
	if !containsString(rec.CallStrings(), "docker compose -f "+compose+" up -d") {
		t.Error("an update must still restart the stack")
	}
}

func TestUpdateModeDryRunStartsNothing(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".alfheim.installed"), []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := healthyDocker()
	app, stdout, _ := newTestApp(t, &Options{InstallDir: root, DryRun: true}, rec, nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d", code)
	}
	for _, c := range rec.CallStrings() {
		if strings.Contains(c, "up -d") {
			t.Fatalf("a dry-run update started containers: %s", c)
		}
	}
	if !strings.Contains(stdout.String(), "no container was started") {
		t.Errorf("stdout = %q", stdout.String())
	}
}

func TestReconfigurePreservesExistingSecrets(t *testing.T) {
	root := t.TempDir()
	const masterkey = "0123456789abcdef0123456789abcdef"
	existing := "ZITADEL_MASTERKEY=" + masterkey + "\nPOSTGRES_PASSWORD=keep-me\n"
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(existing), 0o600); err != nil {
		t.Fatal(err)
	}

	opts := &Options{
		Reconfigure: true, NonInteractive: true, InstallDir: root,
		Domain: "new.example.com", TLSStrategy: "internal",
	}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout.String())
	}

	vars, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	// Rotating the masterkey would make the Zitadel database unreadable.
	if vars["ZITADEL_MASTERKEY"] != masterkey {
		t.Errorf("ZITADEL_MASTERKEY = %q, want it preserved", vars["ZITADEL_MASTERKEY"])
	}
	if vars["POSTGRES_PASSWORD"] != "keep-me" {
		t.Errorf("POSTGRES_PASSWORD = %q, want it preserved", vars["POSTGRES_PASSWORD"])
	}
	// The new domain must have been applied.
	if vars["DOMAIN"] != "new.example.com" {
		t.Errorf("DOMAIN = %q, want the reconfigured value", vars["DOMAIN"])
	}
}

func TestRunRejectsAnInvalidInstallDir(t *testing.T) {
	app, _, stderr := newTestApp(t, &Options{InstallDir: ""}, healthyDocker(), nil)
	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "install root") {
		t.Fatalf("stderr = %q", stderr.String())
	}
}

func TestRunHeadlessMissingAnswerIsReported(t *testing.T) {
	opts := &Options{NonInteractive: true, InstallDir: t.TempDir()}
	app, _, stderr := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "--domain") {
		t.Fatalf("stderr = %q, want the missing input named", stderr.String())
	}
}

func TestRunCustomCertsWithMissingFilesFails(t *testing.T) {
	root := t.TempDir()
	opts := &Options{
		NonInteractive: true, InstallDir: root,
		Domain: "example.com", TLSStrategy: "custom",
	}
	app, _, stderr := newTestApp(t, opts, healthyDocker(), nil)

	if code := app.Run(context.Background()); code != ExitFailure {
		t.Fatalf("exit code = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(stderr.String(), "fullchain.pem") {
		t.Fatalf("stderr = %q, want the expected file names", stderr.String())
	}
}

func TestFirstNonEmpty(t *testing.T) {
	if got := firstNonEmpty("", "", "c"); got != "c" {
		t.Errorf("firstNonEmpty() = %q", got)
	}
	if got := firstNonEmpty(); got != "" {
		t.Errorf("firstNonEmpty() = %q, want empty", got)
	}
}

func TestJoinLines(t *testing.T) {
	if got := joinLines([]string{"a", "b"}); got != "a\n  - b" {
		t.Errorf("joinLines() = %q", got)
	}
}

func containsString(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
