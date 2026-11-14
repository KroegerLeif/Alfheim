package app

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// fakeOrch records the orchestrator calls the apps command makes.
type fakeOrch struct {
	calls            []string
	started, removed []string
	err              error
	renderChanged    bool
	renderErr        error
}

func (f *fakeOrch) EnsureDatabases(context.Context) error {
	f.calls = append(f.calls, "ensure-databases")
	return nil
}

func (f *fakeOrch) StartServices(_ context.Context, s []string) error {
	f.calls = append(f.calls, "start")
	f.started = append(f.started, s...)
	return f.err
}

func (f *fakeOrch) WaitContainers(_ context.Context, c []string) error {
	f.calls = append(f.calls, "wait "+strings.Join(c, ","))
	return nil
}

func (f *fakeOrch) RemoveServices(_ context.Context, s []string) error {
	f.calls = append(f.calls, "remove")
	f.removed = append(f.removed, s...)
	return f.err
}

func (f *fakeOrch) RestartIngress(context.Context) error {
	f.calls = append(f.calls, "restart-ingress")
	return nil
}

func (f *fakeOrch) render() (bool, error) {
	f.calls = append(f.calls, "render")
	return f.renderChanged, f.renderErr
}

func newAppsCommand(t *testing.T, env string) (*AppsCommand, *fakeOrch, *bytes.Buffer, *bytes.Buffer) {
	t.Helper()
	root := t.TempDir()
	if env != "" {
		if err := os.WriteFile(filepath.Join(root, ".env"), []byte(env), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	orch := &fakeOrch{renderChanged: true}
	var stdout, stderr bytes.Buffer
	return &AppsCommand{
		Layout:  paths.Layout{Root: root},
		Applier: composeApplier{orch: orch, render: orch.render},
		Stdout:  &stdout,
		Stderr:  &stderr,
	}, orch, &stdout, &stderr
}

func TestAppsCommandList(t *testing.T) {
	cmd, _, stdout, _ := newAppsCommand(t, "ALFHEIM_ENABLED_APPS=pantry\n")
	if code := cmd.Run(context.Background(), "list", ""); code != ExitOK {
		t.Fatalf("exit %d", code)
	}
	out := stdout.String()
	for _, want := range []string{"household", "core", "pantry", "enabled", "budget", "disabled", "requires pantry"} {
		if !strings.Contains(out, want) {
			t.Errorf("list output lacks %q:\n%s", want, out)
		}
	}
}

func TestAppsCommandEnableDisable(t *testing.T) {
	cmd, starter, _, stderr := newAppsCommand(t, "ALFHEIM_ENABLED_APPS=\n")
	ctx := context.Background()

	if code := cmd.Run(ctx, "enable", "pantry"); code != ExitOK {
		t.Fatalf("enable exit %d: %s", code, stderr)
	}
	if code := cmd.Run(ctx, "disable", "pantry"); code != ExitOK {
		t.Fatalf("disable exit %d: %s", code, stderr)
	}
	want := []string{"pantry-backend", "pantry-frontend"}
	if !reflect.DeepEqual(starter.started, want) || !reflect.DeepEqual(starter.removed, want) {
		t.Errorf("started %v, removed %v", starter.started, starter.removed)
	}
	wantCalls := []string{
		"ensure-databases", "start", "wait pantry-backend,pantry-frontend", "render", "restart-ingress",
		"remove", "render", "restart-ingress",
	}
	if !reflect.DeepEqual(starter.calls, wantCalls) {
		t.Errorf("calls = %v\nwant    %v", starter.calls, wantCalls)
	}
	env, err := envfile.ParseFile(cmd.Layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if env[apps.EnvKey] != "" || env[apps.ProfilesKey] != "" {
		t.Errorf("%s = %q, %s = %q", apps.EnvKey, env[apps.EnvKey], apps.ProfilesKey, env[apps.ProfilesKey])
	}

	if code := cmd.Run(ctx, "enable", "shopping"); code != ExitFailure {
		t.Errorf("enable shopping without pantry: exit %d", code)
	}
	if !strings.Contains(stderr.String(), "requires pantry") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

func TestAppsCommandFailures(t *testing.T) {
	cmd, starter, _, _ := newAppsCommand(t, "")
	if code := cmd.Run(context.Background(), "list", ""); code != ExitFailure {
		t.Errorf("list without .env: exit %d", code)
	}

	cmd, starter, _, _ = newAppsCommand(t, "ALFHEIM_ENABLED_APPS=\n")
	starter.err = errors.New("compose failed")
	if code := cmd.Run(context.Background(), "enable", "chat"); code != ExitFailure {
		t.Errorf("failed start: exit %d", code)
	}

	cmd, starter, _, _ = newAppsCommand(t, "ALFHEIM_ENABLED_APPS=chat\n")
	starter.renderErr = errors.New("template broken")
	if code := cmd.Run(context.Background(), "disable", "chat"); code != ExitFailure {
		t.Errorf("failed render: exit %d", code)
	}

	cmd, starter, _, _ = newAppsCommand(t, "ALFHEIM_ENABLED_APPS=chat\n")
	starter.renderChanged = false
	if code := cmd.Run(context.Background(), "disable", "chat"); code != ExitOK {
		t.Errorf("unchanged Caddyfile: exit %d", code)
	}
	for _, c := range starter.calls {
		if c == "restart-ingress" {
			t.Error("Caddy was restarted although the Caddyfile did not change")
		}
	}
}

func TestParseAppsArgs(t *testing.T) {
	t.Setenv("ALFHEIM_INSTALL_DIR", "")
	tests := []struct {
		args       []string
		action     string
		name       string
		installDir string
		wantErr    bool
	}{
		{args: []string{"list", "--install-dir", "/srv/a"}, action: "list", installDir: "/srv/a"},
		{args: []string{"--install-dir=/srv/a", "enable", "Pantry"}, action: "enable", name: "pantry", installDir: "/srv/a"},
		{args: []string{"disable", "chat", "--install-dir", "/srv/b"}, action: "disable", name: "chat", installDir: "/srv/b"},
		{args: []string{}, wantErr: true},
		{args: []string{"list", "extra"}, wantErr: true},
		{args: []string{"enable"}, wantErr: true},
		{args: []string{"enable", "a", "b"}, wantErr: true},
		{args: []string{"remove", "chat"}, wantErr: true},
		{args: []string{"list", "--bogus"}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(strings.Join(tt.args, " "), func(t *testing.T) {
			action, name, dir, err := parseAppsArgs(tt.args, &bytes.Buffer{})
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if action != tt.action || name != tt.name || dir != tt.installDir {
				t.Errorf("got (%q, %q, %q)", action, name, dir)
			}
		})
	}

	t.Setenv("ALFHEIM_INSTALL_DIR", "/srv/env")
	if _, _, dir, err := parseAppsArgs([]string{"list"}, &bytes.Buffer{}); err != nil || dir != "/srv/env" {
		t.Errorf("env fallback: dir %q, err %v", dir, err)
	}
}

func TestRunAppsUsageAndHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := RunApps([]string{"bogus"}, &stdout, &stderr, BuildInfo{}); code != ExitUsage {
		t.Errorf("unknown action: exit %d", code)
	}
	if code := RunApps([]string{"-h"}, &stdout, &stderr, BuildInfo{}); code != ExitOK {
		t.Errorf("-h: exit %d", code)
	}
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("ALFHEIM_ENABLED_APPS=chat\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stdout.Reset()
	if code := RunApps([]string{"list", "--install-dir", root}, &stdout, &stderr, BuildInfo{}); code != ExitOK {
		t.Fatalf("list: exit %d: %s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "chat") {
		t.Errorf("list output = %q", stdout.String())
	}
	if code := RunApps([]string{"list", "--install-dir", "relative/dir"}, &stdout, &stderr, BuildInfo{}); code == ExitOK {
		t.Error("list succeeded without an installation")
	}
}
