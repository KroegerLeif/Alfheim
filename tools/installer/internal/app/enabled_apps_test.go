package app

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"testing"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// profilesOf returns the COMPOSE_PROFILES a command was run with.
func profilesOf(c runner.Command) (string, bool) {
	for _, e := range c.Env {
		if v, ok := strings.CutPrefix(e, apps.ProfilesKey+"="); ok {
			return v, true
		}
	}
	return "", false
}

func TestUpdateApp_RespectsStoredAppSet(t *testing.T) {
	dir := t.TempDir()
	writeExistingInstall(t, dir, "v1.0.0")
	if err := envfile.Update(filepath.Join(dir, ".env"), map[string]string{apps.EnvKey: "pantry,shopping"}); err != nil {
		t.Fatal(err)
	}
	srv := startAssetServer(t, updateAssetContents("v1.1.0"))
	defer srv.Close()

	app, _, stderr := newTestUpdateApp(dir, &UpdateOptions{
		InstallDir: dir, Version: "v1.1.0", Yes: true, Repo: defaultUpdateRepo,
	}, srv)
	if code := app.Run(context.Background()); code != ExitOK {
		t.Fatalf("Run() = %d; stderr=%s", code, stderr.String())
	}
	rec := app.Runner.(*backupDocker).RecordingRunner
	restarted := false
	for _, c := range rec.Calls() {
		if !strings.Contains(c.String(), "up -d --remove-orphans") {
			continue
		}
		restarted = true
		if p, ok := profilesOf(c); !ok || p != "pantry,shopping" {
			t.Errorf("restart ran with COMPOSE_PROFILES=%q (set: %v), want pantry,shopping", p, ok)
		}
	}
	if !restarted {
		t.Fatalf("no restart recorded: %v", rec.CallStrings())
	}
	after, err := envfile.ParseFile(filepath.Join(dir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	if after[apps.EnvKey] != "pantry,shopping" {
		t.Errorf("the stored set changed: %q", after[apps.EnvKey])
	}
}

func TestRecordEnabledApps(t *testing.T) {
	dir := t.TempDir()
	layout := paths.Layout{Root: dir}
	writeExistingInstall(t, dir, "v1.0.0")
	env, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	set, err := recordEnabledApps(&out, layout, env)
	if err != nil {
		t.Fatal(err)
	}
	if set.String() != apps.All().String() {
		t.Errorf("legacy install set = %q, want every app", set)
	}
	after, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if after[apps.EnvKey] != apps.All().String() || after[apps.ProfilesKey] != apps.All().String() {
		t.Errorf(".env after backfill: %s=%q %s=%q", apps.EnvKey, after[apps.EnvKey],
			apps.ProfilesKey, after[apps.ProfilesKey])
	}

	// A recorded set is returned as is and .env is not rewritten.
	out.Reset()
	if _, err := recordEnabledApps(&out, layout, map[string]string{apps.EnvKey: "chat"}); err != nil {
		t.Fatal(err)
	}
	if out.Len() != 0 {
		t.Errorf("a recorded set was written again: %q", out.String())
	}
	if _, err := recordEnabledApps(&out, layout, map[string]string{apps.EnvKey: "shopping"}); err == nil {
		t.Error("an invalid stored set was accepted")
	}
	if _, err := recordEnabledApps(&out, paths.Layout{Root: filepath.Join(dir, "missing")}, map[string]string{}); err == nil {
		t.Error("a write to a missing .env succeeded")
	}
	if _, err := loadEnabledApps(paths.Layout{Root: filepath.Join(dir, "missing")}); err == nil {
		t.Error("loadEnabledApps without .env succeeded")
	}
}
