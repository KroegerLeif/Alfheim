package app

import (
	"bytes"
	"context"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/mode"
	"alfheim/installer/internal/shared/paths"
)

// headlessInstall runs a non-interactive install with the given --apps value
// and returns the resulting .env and the recorded compose calls.
func headlessInstall(t *testing.T, selection string) (map[string]string, []string) {
	t.Helper()
	root := t.TempDir()
	opts := &Options{
		NonInteractive: true, InstallDir: root, Apps: selection,
		Domain: "example.com", TLSStrategy: "internal", AdminEmail: "ops@example.com",
	}
	rec := healthyDocker()
	app, stdout, stderr := newTestApp(t, opts, rec, nil)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s stderr=%s", code, stdout, stderr)
	}
	env, err := envfile.ParseFile(filepath.Join(root, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	var profiles []string
	for _, c := range rec.Calls() {
		if p, ok := profilesOf(c); ok {
			profiles = append(profiles, p)
		}
	}
	return env, profiles
}

func TestProvisionAppsNoneIsLeanCore(t *testing.T) {
	for _, selection := range []string{"none", ""} {
		env, profiles := headlessInstall(t, selection)
		if v, ok := env[apps.EnvKey]; !ok || v != "" {
			t.Errorf("--apps=%q: %s = %q (present %v), want empty", selection, apps.EnvKey, v, ok)
		}
		if env[apps.ProfilesKey] != "" || env[apps.OTELEnabledKey] != "false" {
			t.Errorf("--apps=%q: COMPOSE_PROFILES=%q OTEL_ENABLED=%q", selection,
				env[apps.ProfilesKey], env[apps.OTELEnabledKey])
		}
		if len(profiles) == 0 {
			t.Fatalf("--apps=%q: no compose call carried COMPOSE_PROFILES", selection)
		}
		for _, p := range profiles {
			if p != "" {
				t.Errorf("--apps=%q: compose ran with COMPOSE_PROFILES=%q", selection, p)
			}
		}
	}
}

func TestProvisionAppsAllMatchesPreviousBehaviour(t *testing.T) {
	env, profiles := headlessInstall(t, "all")
	all := apps.All().String()
	if env[apps.EnvKey] != all || env[apps.ProfilesKey] != all || env[apps.OTELEnabledKey] != "true" {
		t.Errorf(".env: %s=%q COMPOSE_PROFILES=%q OTEL_ENABLED=%q", apps.EnvKey, env[apps.EnvKey],
			env[apps.ProfilesKey], env[apps.OTELEnabledKey])
	}
	for _, p := range profiles {
		if p != all {
			t.Errorf("compose ran with COMPOSE_PROFILES=%q, want %q", p, all)
		}
	}
}

func TestParseOptionsApps(t *testing.T) {
	t.Setenv("ALFHEIM_APPS", "")
	for _, tc := range []struct {
		args    []string
		env     string
		want    string
		wantErr bool
	}{
		{args: []string{"--apps=none"}, want: "none"},
		{args: []string{"--apps", "pantry,shopping"}, want: "pantry,shopping"},
		{args: nil, env: "all", want: "all"},
		{args: []string{"--apps=chat"}, env: "all", want: "chat"},
		{args: []string{"--apps=todo"}, wantErr: true},
		{args: []string{"--apps=shopping"}, wantErr: true},
	} {
		t.Setenv("ALFHEIM_APPS", tc.env)
		opts, err := ParseOptions(append(tc.args, "--install-dir", t.TempDir()), &bytes.Buffer{})
		if (err != nil) != tc.wantErr {
			t.Errorf("%v: err = %v", tc.args, err)
			continue
		}
		if err == nil && opts.Apps != tc.want {
			t.Errorf("%v (env %q): Apps = %q, want %q", tc.args, tc.env, opts.Apps, tc.want)
		}
	}
}

// appsWizard answers the app step like an operator would.
type appsWizard struct {
	stubWizard
	selected  []string
	telemetry bool
	err       error
	seen      onboarding.AppSelection
}

func (w *appsWizard) AskApps(sel *onboarding.AppSelection) error {
	w.seen = *sel
	sel.Selected = w.selected
	sel.Telemetry = w.telemetry
	return w.err
}

func TestInteractiveWizardAsksForApps(t *testing.T) {
	wiz := &appsWizard{stubWizard: interactiveStub(), selected: []string{"pantry", "chat"}, telemetry: true}
	opts := &Options{InstallDir: t.TempDir()}
	app, stdout, _ := newTestApp(t, opts, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("exit code = %d; stdout=%s", code, stdout)
	}
	if len(wiz.seen.Selected) != 0 || wiz.seen.Telemetry {
		t.Errorf("a fresh install must pre-select the Lean Core, got %v telemetry=%v",
			wiz.seen.Selected, wiz.seen.Telemetry)
	}
	env, err := envfile.ParseFile(filepath.Join(opts.InstallDir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if env[apps.EnvKey] != "pantry,chat,telemetry" {
		t.Errorf("%s = %q", apps.EnvKey, env[apps.EnvKey])
	}

	wiz = &appsWizard{stubWizard: interactiveStub(), err: errors.New("aborted")}
	app, _, _ = newTestApp(t, &Options{InstallDir: t.TempDir()}, healthyDocker(), wiz)
	if code := app.Run(context.Background()); code == ExitOK {
		t.Error("an aborted app step must fail the install")
	}
}

func TestConfigureAppsKeepsTheStoredSet(t *testing.T) {
	root := t.TempDir()
	writeExistingInstall(t, root, "v1.0.0")
	app, _, _ := newTestApp(t, &Options{InstallDir: root, NonInteractive: true}, healthyDocker(), nil)
	layout := paths.Layout{Root: root}

	// An existing install without a stored set keeps every app.
	set, err := app.configureApps(layout, mode.ModeUpdate)
	if err != nil || set.String() != apps.All().String() {
		t.Errorf("legacy re-run: %q, %v", set, err)
	}
	if err := envfile.Update(layout.EnvFile(), map[string]string{apps.EnvKey: "budget"}); err != nil {
		t.Fatal(err)
	}
	if set, err = app.configureApps(layout, mode.ModeUpdate); err != nil || set.String() != "budget" {
		t.Errorf("stored set: %q, %v", set, err)
	}
	app.Options.Apps = "all"
	if set, err = app.configureApps(layout, mode.ModeUpdate); err != nil || set.String() != apps.All().String() {
		t.Errorf("--apps=all: %q, %v", set, err)
	}
}

func TestSelectionModel(t *testing.T) {
	set, err := apps.Parse("pantry,shopping,telemetry")
	if err != nil {
		t.Fatal(err)
	}
	sel := selectionFor(set)
	if !reflect.DeepEqual(sel.Selected, []string{"pantry", "shopping"}) || !sel.Telemetry {
		t.Errorf("pre-selection = %v telemetry=%v", sel.Selected, sel.Telemetry)
	}
	if len(sel.Choices) != 8 || sel.TelemetryMemoryMB == 0 {
		t.Errorf("choices = %d, telemetry memory = %d", len(sel.Choices), sel.TelemetryMemoryMB)
	}
	for _, c := range sel.Choices {
		if c.Description == "" || c.MemoryMB == 0 || !strings.Contains(c.Label(), "MB") {
			t.Errorf("choice %s lacks catalog data: %+v", c.Name, c)
		}
	}
	if err := sel.Validate([]string{"shopping"}); !errors.Is(err, apps.ErrDependency) {
		t.Errorf("Validate(shopping) = %v", err)
	}
	if err := sel.Validate([]string{"shopping", "pantry"}); err != nil {
		t.Errorf("Validate(shopping, pantry) = %v", err)
	}
	if onboarding.NewAppsForm(&sel) == nil {
		t.Error("NewAppsForm returned nil")
	}
}
