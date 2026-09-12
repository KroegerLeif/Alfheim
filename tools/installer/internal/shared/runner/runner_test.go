package runner

import (
	"bytes"
	"context"
	"errors"
	"os"
	"runtime"
	"strings"
	"testing"
)

func TestCommandString(t *testing.T) {
	tests := []struct {
		name string
		cmd  Command
		want string
	}{
		{"no args", Command{Name: "docker"}, "docker"},
		{"with args", Command{Name: "docker", Args: []string{"compose", "up", "-d"}},
			"docker compose up -d"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cmd.String(); got != tc.want {
				t.Fatalf("String() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExecRunner_Success(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	var sink bytes.Buffer
	r := NewExec()
	res, err := r.Run(context.Background(), Command{
		Name: "echo", Args: []string{"hello"}, Stdout: &sink,
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if res.ExitCode != 0 {
		t.Fatalf("ExitCode = %d, want 0", res.ExitCode)
	}
	if !strings.Contains(res.Stdout, "hello") {
		t.Fatalf("Stdout = %q, want it to contain %q", res.Stdout, "hello")
	}
	if !strings.Contains(sink.String(), "hello") {
		t.Fatal("streamed writer did not receive the output")
	}
}

func TestExecRunner_NonZeroExitIsNotAnError(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	r := NewExec()
	res, err := r.Run(context.Background(), Command{
		Name: "sh", Args: []string{"-c", "exit 7"},
	})
	if err != nil {
		t.Fatalf("Run() error = %v, want nil for a non-zero exit", err)
	}
	if res.ExitCode != 7 {
		t.Fatalf("ExitCode = %d, want 7", res.ExitCode)
	}
}

func TestExecRunner_MissingBinaryIsAnError(t *testing.T) {
	r := NewExec()
	if _, err := r.Run(context.Background(), Command{
		Name: "alfheim-does-not-exist",
	}); err == nil {
		t.Fatal("Run() error = nil, want a failure for a missing binary")
	}
}

func TestExecRunner_CancelledContext(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	r := NewExec()
	_, err := r.Run(ctx, Command{Name: "sh", Args: []string{"-c", "sleep 5"}})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Run() error = %v, want context.Canceled", err)
	}
}

func TestExecRunner_EnvAndDir(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	dir := t.TempDir()
	r := NewExec()
	res, err := r.Run(context.Background(), Command{
		Name: "sh", Args: []string{"-c", "printf %s \"$ALFHEIM_PROBE\"; pwd"},
		Dir: dir, Env: []string{"ALFHEIM_PROBE=set"},
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if !strings.Contains(res.Stdout, "set") {
		t.Fatalf("Stdout = %q, want the injected variable", res.Stdout)
	}
}

func TestExecRunner_LookPath(t *testing.T) {
	r := NewExec()
	if _, err := r.LookPath("sh"); err != nil && runtime.GOOS != "windows" {
		t.Fatalf("LookPath(sh) error = %v", err)
	}
	if _, err := r.LookPath("alfheim-does-not-exist"); err == nil {
		t.Fatal("LookPath() error = nil, want a failure")
	}
}

func TestRecordingRunner(t *testing.T) {
	rec := NewRecording(map[string]Result{
		"docker info": {ExitCode: 0, Stdout: "27.0.0"},
	})
	rec.Fallback = Result{ExitCode: 1}

	res, err := rec.Run(context.Background(), Command{Name: "docker", Args: []string{"info"}})
	if err != nil || res.Stdout != "27.0.0" {
		t.Fatalf("scripted result = %+v, err = %v", res, err)
	}

	res, _ = rec.Run(context.Background(), Command{Name: "docker", Args: []string{"ps"}})
	if res.ExitCode != 1 {
		t.Fatalf("fallback ExitCode = %d, want 1", res.ExitCode)
	}

	want := []string{"docker info", "docker ps"}
	got := rec.CallStrings()
	if len(got) != len(want) {
		t.Fatalf("CallStrings() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("call %d = %q, want %q", i, got[i], want[i])
		}
	}
	if calls := rec.Calls(); len(calls) != 2 {
		t.Fatalf("Calls() length = %d, want 2", len(calls))
	}
}

func TestRecordingRunner_ScriptedErrorAndResult(t *testing.T) {
	rec := NewRecording(nil)
	sentinel := errors.New("daemon unreachable")
	rec.ScriptError("docker info", sentinel)
	rec.ScriptResult("docker ps", Result{ExitCode: 0, Stdout: "alfheim_caddy"})

	if _, err := rec.Run(context.Background(), Command{
		Name: "docker", Args: []string{"info"},
	}); !errors.Is(err, sentinel) {
		t.Fatalf("error = %v, want %v", err, sentinel)
	}
	res, _ := rec.Run(context.Background(), Command{Name: "docker", Args: []string{"ps"}})
	if res.Stdout != "alfheim_caddy" {
		t.Fatalf("Stdout = %q", res.Stdout)
	}
}

func TestRecordingRunner_LookPath(t *testing.T) {
	rec := NewRecording(nil)
	if path, err := rec.LookPath("docker"); err != nil || path == "" {
		t.Fatalf("lenient LookPath = %q, %v", path, err)
	}

	rec.StrictLookPath = true
	if _, err := rec.LookPath("docker"); err == nil {
		t.Fatal("strict LookPath() error = nil, want a failure")
	}
	rec.SetPath("docker", "/usr/local/bin/docker")
	if path, err := rec.LookPath("docker"); err != nil || path != "/usr/local/bin/docker" {
		t.Fatalf("LookPath = %q, %v", path, err)
	}
}

func TestDryRunRunner_SkipsMutatingCommands(t *testing.T) {
	inner := NewRecording(map[string]Result{
		"docker compose ps": {ExitCode: 0, Stdout: "running"},
	})
	var log bytes.Buffer
	dry := NewDryRun(inner, &log)

	// A read-only command still executes so inspection reports the truth.
	res, err := dry.Run(context.Background(), Command{
		Name: "docker", Args: []string{"compose", "ps"},
	})
	if err != nil || res.Stdout != "running" {
		t.Fatalf("read-only command was not executed: %+v, %v", res, err)
	}

	// A mutating command is recorded but never reaches the inner runner.
	if _, err := dry.Run(context.Background(), Command{
		Name: "docker", Args: []string{"compose", "-f", "compose.prod.yaml", "up", "-d"},
	}); err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	if got := inner.CallStrings(); len(got) != 1 {
		t.Fatalf("inner runner saw %v, want only the read-only command", got)
	}
	if len(dry.Calls()) != 2 {
		t.Fatalf("dry run recorded %d calls, want 2", len(dry.Calls()))
	}
	if !strings.Contains(log.String(), "[dry-run] would execute") {
		t.Fatalf("log = %q, want a dry-run notice", log.String())
	}
}

func TestDryRunRunner_LookPathDelegates(t *testing.T) {
	inner := NewRecording(nil)
	inner.SetPath("docker", "/usr/bin/docker")
	dry := NewDryRun(inner, os.Stdout)
	if path, err := dry.LookPath("docker"); err != nil || path != "/usr/bin/docker" {
		t.Fatalf("LookPath = %q, %v", path, err)
	}
}

func TestDryRunRunner_IsMutating(t *testing.T) {
	dry := NewDryRun(NewRecording(nil), nil)
	tests := []struct {
		args []string
		want bool
	}{
		{[]string{"compose", "up", "-d"}, true},
		{[]string{"compose", "pull"}, true},
		{[]string{"compose", "down"}, true},
		{[]string{"compose", "ps"}, false},
		{[]string{"info"}, false},
		{[]string{"-f", "x.yaml", "compose", "restart"}, true},
		{nil, false},
	}
	for _, tc := range tests {
		got := dry.isMutating(Command{Name: "docker", Args: tc.args})
		if got != tc.want {
			t.Fatalf("isMutating(%v) = %v, want %v", tc.args, got, tc.want)
		}
	}
}

func TestDryRunRunner_PropagatesRecordingError(t *testing.T) {
	dry := NewDryRun(NewRecording(nil), nil)
	if _, err := dry.Run(context.Background(), Command{Name: "docker"}); err != nil {
		t.Fatalf("Run() error = %v", err)
	}
}
