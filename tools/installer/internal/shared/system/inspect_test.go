package system

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"

	"alfheim/installer/internal/shared/runner"
)

// busyListen simulates the supplied ports being occupied.
func busyListen(busy ...string) listenFunc {
	set := map[string]bool{}
	for _, addr := range busy {
		set[addr] = true
	}
	return func(network, address string) (net.Listener, error) {
		if set[address] {
			return nil, errors.New("address already in use")
		}
		return net.Listen(network, "127.0.0.1:0")
	}
}

// readyRunner scripts a fully healthy host.
func readyRunner() *runner.RecordingRunner {
	return runner.NewRecording(map[string]runner.Result{
		"docker info --format {{.ServerVersion}}": {ExitCode: 0, Stdout: "27.0.1\n"},
		"docker compose version --short":          {ExitCode: 0, Stdout: "2.29.1\n"},
	})
}

func newTestInspector(r runner.Runner, listen listenFunc) *HostInspector {
	insp := NewInspector(r)
	insp.listen = listen
	return insp
}

func TestInspect_HealthyHost(t *testing.T) {
	insp := newTestInspector(readyRunner(), busyListen())

	rep, err := insp.Inspect(context.Background())
	if err != nil {
		t.Fatalf("Inspect() error = %v", err)
	}
	if !rep.DockerInstalled || !rep.DaemonRunning || !rep.ComposeV2 {
		t.Fatalf("report = %+v, want a fully ready host", rep)
	}
	if rep.ComposeVersion != "2.29.1" {
		t.Fatalf("ComposeVersion = %q, want %q", rep.ComposeVersion, "2.29.1")
	}
	if !rep.Port80Free || !rep.Port443Free {
		t.Fatal("both ingress ports should be reported free")
	}
	if !rep.OK() {
		t.Fatalf("OK() = false, blocking = %v", rep.Blocking())
	}
	if rep.Arch == "" || rep.OS == "" {
		t.Fatal("Arch and OS must be populated")
	}
}

func TestInspect_DockerMissing(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.StrictLookPath = true
	insp := newTestInspector(rec, busyListen())

	rep, err := insp.Inspect(context.Background())
	if err != nil {
		t.Fatalf("Inspect() error = %v", err)
	}
	if rep.DockerInstalled {
		t.Fatal("DockerInstalled = true, want false")
	}
	if rep.OK() {
		t.Fatal("OK() = true without Docker")
	}
	if !strings.Contains(strings.Join(rep.Blocking(), "; "), "not installed") {
		t.Fatalf("Blocking() = %v, want it to mention the missing install", rep.Blocking())
	}
}

func TestInspect_DaemonDown(t *testing.T) {
	rec := runner.NewRecording(map[string]runner.Result{
		"docker info --format {{.ServerVersion}}": {ExitCode: 1, Stderr: "cannot connect"},
	})
	insp := newTestInspector(rec, busyListen())

	rep, err := insp.Inspect(context.Background())
	if err != nil {
		t.Fatalf("Inspect() error = %v", err)
	}
	if !rep.DockerInstalled || rep.DaemonRunning {
		t.Fatalf("report = %+v, want an installed but stopped daemon", rep)
	}
	if !strings.Contains(strings.Join(rep.Blocking(), "; "), "daemon is not running") {
		t.Fatalf("Blocking() = %v", rep.Blocking())
	}
}

func TestInspect_DaemonProbeError(t *testing.T) {
	rec := readyRunner()
	rec.ScriptError("docker info --format {{.ServerVersion}}", errors.New("boom"))
	insp := newTestInspector(rec, busyListen())

	if _, err := insp.Inspect(context.Background()); err == nil {
		t.Fatal("Inspect() error = nil, want the probe failure to surface")
	}
}

func TestInspect_ComposeVersions(t *testing.T) {
	tests := []struct {
		name        string
		result      runner.Result
		wantOK      bool
		wantVersion string
	}{
		{"modern v2", runner.Result{ExitCode: 0, Stdout: "2.29.1\n"}, true, "2.29.1"},
		{"prefixed v2", runner.Result{ExitCode: 0, Stdout: "v2.5.0\n"}, true, "v2.5.0"},
		{"legacy v1", runner.Result{ExitCode: 0, Stdout: "1.29.2\n"}, false, "1.29.2"},
		{"exact minimum", runner.Result{ExitCode: 0, Stdout: "2.0.0\n"}, true, "2.0.0"},
		{"plugin absent", runner.Result{ExitCode: 125}, false, ""},
		{"unparsable", runner.Result{ExitCode: 0, Stdout: "banana\n"}, false, "banana"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := readyRunner()
			rec.ScriptResult("docker compose version --short", tc.result)
			insp := newTestInspector(rec, busyListen())

			rep, err := insp.Inspect(context.Background())
			if err != nil {
				t.Fatalf("Inspect() error = %v", err)
			}
			if rep.ComposeV2 != tc.wantOK {
				t.Fatalf("ComposeV2 = %v, want %v", rep.ComposeV2, tc.wantOK)
			}
			if rep.ComposeVersion != tc.wantVersion {
				t.Fatalf("ComposeVersion = %q, want %q", rep.ComposeVersion, tc.wantVersion)
			}
		})
	}
}

func TestInspect_ComposeProbeError(t *testing.T) {
	rec := readyRunner()
	rec.ScriptError("docker compose version --short", errors.New("boom"))
	insp := newTestInspector(rec, busyListen())

	if _, err := insp.Inspect(context.Background()); err == nil {
		t.Fatal("Inspect() error = nil, want the probe failure to surface")
	}
}

func TestInspect_PortHeldByForeignProcess(t *testing.T) {
	rec := readyRunner()
	rec.ScriptResult("docker ps --filter publish=80 --format {{.Names}}",
		runner.Result{ExitCode: 0, Stdout: "nginx-legacy\n"})
	insp := newTestInspector(rec, busyListen(":80"))

	rep, err := insp.Inspect(context.Background())
	if err != nil {
		t.Fatalf("Inspect() error = %v", err)
	}
	if rep.Port80Free {
		t.Fatal("Port80Free = true, want false")
	}
	if len(rep.PortConflicts) != 1 || rep.PortConflicts[0].HeldBy != "nginx-legacy" {
		t.Fatalf("PortConflicts = %+v", rep.PortConflicts)
	}
	if rep.OK() {
		t.Fatal("a foreign process on port 80 must block the install")
	}
}

func TestInspect_PortHeldByOwnGatewayIsNotBlocking(t *testing.T) {
	rec := readyRunner()
	rec.ScriptResult("docker ps --filter publish=80 --format {{.Names}}",
		runner.Result{ExitCode: 0, Stdout: "alfheim_caddy\n"})
	rec.ScriptResult("docker ps --filter publish=443 --format {{.Names}}",
		runner.Result{ExitCode: 0, Stdout: "alfheim_caddy\n"})
	insp := newTestInspector(rec, busyListen(":80", ":443"))

	rep, err := insp.Inspect(context.Background())
	if err != nil {
		t.Fatalf("Inspect() error = %v", err)
	}
	if len(rep.PortConflicts) != 2 {
		t.Fatalf("PortConflicts = %+v, want both ports recorded", rep.PortConflicts)
	}
	if !rep.OK() {
		t.Fatalf("a Day-2 re-run must not be blocked by our own gateway: %v", rep.Blocking())
	}
}

func TestInspect_PortAttributionFallbacks(t *testing.T) {
	tests := []struct {
		name   string
		result runner.Result
		err    error
	}{
		{"docker ps fails", runner.Result{ExitCode: 1}, nil},
		{"docker ps errors", runner.Result{}, errors.New("boom")},
		{"no container matches", runner.Result{ExitCode: 0, Stdout: "  \n"}, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := readyRunner()
			key := "docker ps --filter publish=443 --format {{.Names}}"
			if tc.err != nil {
				rec.ScriptError(key, tc.err)
			} else {
				rec.ScriptResult(key, tc.result)
			}
			insp := newTestInspector(rec, busyListen(":443"))

			rep, err := insp.Inspect(context.Background())
			if err != nil {
				t.Fatalf("Inspect() error = %v", err)
			}
			if len(rep.PortConflicts) != 1 {
				t.Fatalf("PortConflicts = %+v", rep.PortConflicts)
			}
			if rep.PortConflicts[0].HeldBy != "an unknown process" {
				t.Fatalf("HeldBy = %q, want the unknown-process fallback",
					rep.PortConflicts[0].HeldBy)
			}
		})
	}
}

func TestInspect_MultilinePortAttribution(t *testing.T) {
	rec := readyRunner()
	rec.ScriptResult("docker ps --filter publish=80 --format {{.Names}}",
		runner.Result{ExitCode: 0, Stdout: "first\nsecond\n"})
	insp := newTestInspector(rec, busyListen(":80"))

	rep, _ := insp.Inspect(context.Background())
	if rep.PortConflicts[0].HeldBy != "first" {
		t.Fatalf("HeldBy = %q, want the first match", rep.PortConflicts[0].HeldBy)
	}
}

func TestIsAlfheimContainer(t *testing.T) {
	if !isAlfheimContainer("alfheim_caddy") {
		t.Fatal("alfheim_caddy must be recognised as our own container")
	}
	if isAlfheimContainer("nginx") {
		t.Fatal("nginx must not be recognised as our own container")
	}
}
