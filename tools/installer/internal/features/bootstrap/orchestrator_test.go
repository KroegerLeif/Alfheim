package bootstrap

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

const composeFile = "/srv/alfheim/compose.prod.yaml"

var testLayout = paths.Layout{Root: "/srv/alfheim"}

// fakeClock advances instantly, so timeout paths cost no real time.
type fakeClock struct {
	now    time.Time
	sleeps int
	// cancelAfter aborts the context after this many sleeps, simulating an
	// interrupt arriving mid-wait.
	cancelAfter int
	cancel      context.CancelFunc
}

func newFakeClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)}
}

func (f *fakeClock) Now() time.Time { return f.now }

func (f *fakeClock) Sleep(_ context.Context, d time.Duration) error {
	f.sleeps++
	f.now = f.now.Add(d)
	if f.cancelAfter > 0 && f.sleeps >= f.cancelAfter && f.cancel != nil {
		f.cancel()
		return context.Canceled
	}
	return nil
}

// healthyRunner scripts a stack where every container comes up cleanly.
func healthyRunner() *runner.RecordingRunner {
	rec := runner.NewRecording(nil)
	for _, c := range []string{
		"alfheim_postgres_core", "alfheim_caddy", "alfheim_zitadel",
		"dashboard-backend", "dashboard-frontend",
	} {
		rec.ScriptResult(inspectKey(c), runner.Result{ExitCode: 0, Stdout: "running|healthy\n"})
	}
	return rec
}

func inspectKey(container string) string {
	return "docker inspect --format " +
		"{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} " +
		container
}

func newTestOrchestrator(r runner.Runner) (*Orchestrator, *fakeClock) {
	clk := newFakeClock()
	o := New(r, testLayout, WithClock(clk))
	return o, clk
}

// runBothPhases mimics what app.runBootstrap does: run Edge & Identity, then
// (with provisioning happening in between, out of this package's scope) run
// the Core & Application Stack phase.
func runBothPhases(ctx context.Context, o *Orchestrator) error {
	if err := o.RunPhase(ctx, PhaseEdgeAuth); err != nil {
		return err
	}
	return o.RunPhase(ctx, PhaseCoreStack)
}

func TestRunPhase_TwoPhaseSequence(t *testing.T) {
	rec := healthyRunner()
	o, _ := newTestOrchestrator(rec)

	if err := runBothPhases(context.Background(), o); err != nil {
		t.Fatalf("runBothPhases() error = %v", err)
	}

	calls := rec.CallStrings()

	wantPhase1 := "docker compose -f " + composeFile + " up -d postgres-core caddy zitadel"
	if !contains(calls, wantPhase1) {
		t.Fatalf("phase 1 start not found in %v", calls)
	}

	fullStackUp := "docker compose -f " + composeFile + " up -d"
	if !contains(calls, fullStackUp) {
		t.Fatalf("phase 2 start not found in %v", calls)
	}
	if indexOf(calls, wantPhase1) > indexOf(calls, fullStackUp) {
		t.Fatalf("phase 1 must start before phase 2; calls = %v", calls)
	}
}

func TestRunPhase_PullsBeforeStarting(t *testing.T) {
	rec := healthyRunner()
	o, _ := newTestOrchestrator(rec)
	if err := runBothPhases(context.Background(), o); err != nil {
		t.Fatal(err)
	}

	calls := rec.CallStrings()
	pull := indexOf(calls, "docker compose -f "+composeFile+" pull postgres-core caddy zitadel")
	up := indexOf(calls, "docker compose -f "+composeFile+" up -d postgres-core caddy zitadel")
	if pull < 0 || up < 0 || pull > up {
		t.Fatalf("images must be pulled before services start; calls = %v", calls)
	}
}

func TestRunPhase_AbortsWhenPhaseOneIsUnhealthy(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult(inspectKey("alfheim_zitadel"),
		runner.Result{ExitCode: 0, Stdout: "running|unhealthy\n"})

	o, _ := newTestOrchestrator(rec)

	err := runBothPhases(context.Background(), o)
	if err == nil {
		t.Fatal("runBothPhases() error = nil, want the unhealthy container to abort the run")
	}
	if !strings.Contains(err.Error(), "Zitadel") {
		t.Fatalf("error = %v, want it to name the failing service", err)
	}
	if contains(rec.CallStrings(), "docker compose -f "+composeFile+" up -d") {
		t.Fatal("phase 2 must not start after phase 1 failed")
	}
}

func TestRunPhase_AbortsWhenContainerExits(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult(inspectKey("alfheim_postgres_core"),
		runner.Result{ExitCode: 0, Stdout: "exited|none\n"})

	o, _ := newTestOrchestrator(rec)
	err := runBothPhases(context.Background(), o)
	if err == nil || !strings.Contains(err.Error(), "docker logs alfheim_postgres_core") {
		t.Fatalf("error = %v, want actionable remediation", err)
	}
}

func TestRunPhase_PullFailureIsReported(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult("docker compose -f "+composeFile+" pull postgres-core caddy zitadel",
		runner.Result{ExitCode: 1, Stderr: "manifest unknown"})

	o, _ := newTestOrchestrator(rec)
	err := o.RunPhase(context.Background(), PhaseEdgeAuth)
	if err == nil || !strings.Contains(err.Error(), "pull images") {
		t.Fatalf("error = %v, want a pull failure", err)
	}
	if !strings.Contains(err.Error(), "manifest unknown") {
		t.Fatalf("error = %v, want the docker stderr included", err)
	}
}

func TestRunPhase_UpFailureIsReported(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult("docker compose -f "+composeFile+" up -d postgres-core caddy zitadel",
		runner.Result{ExitCode: 1, Stderr: "port is already allocated"})

	o, _ := newTestOrchestrator(rec)
	err := o.RunPhase(context.Background(), PhaseEdgeAuth)
	if err == nil || !strings.Contains(err.Error(), "start Edge & Identity") {
		t.Fatalf("error = %v", err)
	}
}

func TestRestartIngress_RestartsCaddyAndWaits(t *testing.T) {
	rec := healthyRunner()
	o, _ := newTestOrchestrator(rec)
	if err := o.RestartIngress(context.Background()); err != nil {
		t.Fatalf("RestartIngress() error = %v", err)
	}
	calls := rec.CallStrings()
	restart := indexOf(calls, "docker compose -f "+composeFile+" restart caddy")
	wait := indexOf(calls, inspectKey("alfheim_caddy"))
	if restart < 0 || wait < restart {
		t.Fatalf("calls = %v, want a caddy restart followed by a health wait", calls)
	}
}

func TestRestartIngress_FailureIsReported(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult("docker compose -f "+composeFile+" restart caddy",
		runner.Result{ExitCode: 1, Stderr: "no such service"})
	o, _ := newTestOrchestrator(rec)
	err := o.RestartIngress(context.Background())
	if err == nil || !strings.Contains(err.Error(), "restart caddy") {
		t.Fatalf("error = %v, want the restart failure", err)
	}
}

func TestRunPhase_RunnerErrorPropagates(t *testing.T) {
	rec := healthyRunner()
	sentinel := errors.New("docker vanished")
	rec.ScriptError("docker compose -f "+composeFile+" pull postgres-core caddy zitadel", sentinel)

	o, _ := newTestOrchestrator(rec)
	if err := o.RunPhase(context.Background(), PhaseEdgeAuth); !errors.Is(err, sentinel) {
		t.Fatalf("error = %v, want %v", err, sentinel)
	}
}

func TestWaitHealthy_TimesOut(t *testing.T) {
	rec := healthyRunner()
	// The container never leaves the starting state.
	rec.ScriptResult(inspectKey("alfheim_caddy"),
		runner.Result{ExitCode: 0, Stdout: "running|starting\n"})

	o, clk := newTestOrchestrator(rec)
	err := o.waitHealthy(context.Background(), HealthTarget{
		Container: "alfheim_caddy", Label: "Caddy", Timeout: 30 * time.Second,
	})
	if err == nil || !strings.Contains(err.Error(), "timed out after 30s") {
		t.Fatalf("error = %v, want a timeout", err)
	}
	if clk.sleeps == 0 {
		t.Fatal("the wait loop never polled")
	}
}

func TestWaitHealthy_ContainerNotYetCreated(t *testing.T) {
	rec := runner.NewRecording(nil)
	// docker inspect exits non-zero until the container exists.
	rec.Fallback = runner.Result{ExitCode: 1, Stderr: "No such object"}

	o, _ := newTestOrchestrator(rec)
	err := o.waitHealthy(context.Background(), HealthTarget{
		Container: "alfheim_caddy", Label: "Caddy", Timeout: 10 * time.Second,
	})
	if err == nil || !strings.Contains(err.Error(), "timed out") {
		t.Fatalf("error = %v, want a timeout rather than an immediate failure", err)
	}
}

func TestWaitHealthy_ContainerWithoutHealthcheck(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.Fallback = runner.Result{ExitCode: 0, Stdout: "running|none\n"}

	o, _ := newTestOrchestrator(rec)
	if err := o.waitHealthy(context.Background(), HealthTarget{
		Container: "x", Label: "X", Timeout: 10 * time.Second,
	}); err != nil {
		t.Fatalf("a running container without a healthcheck must count as ready: %v", err)
	}
}

// sequencingRunner returns a different scripted result on each call, so a
// container can be observed transitioning between states.
type sequencingRunner struct {
	results []runner.Result
	calls   int
}

func (s *sequencingRunner) Run(context.Context, runner.Command) (runner.Result, error) {
	idx := s.calls
	if idx >= len(s.results) {
		idx = len(s.results) - 1
	}
	s.calls++
	return s.results[idx], nil
}

func (s *sequencingRunner) LookPath(b string) (string, error) { return "/usr/bin/" + b, nil }

func TestWaitHealthy_TransitionsFromStartingToHealthy(t *testing.T) {
	seq := &sequencingRunner{results: []runner.Result{
		{ExitCode: 1, Stderr: "No such object"}, // not created yet
		{ExitCode: 0, Stdout: "created|\n"},     // created, not running
		{ExitCode: 0, Stdout: "running|starting\n"},
		{ExitCode: 0, Stdout: "running|healthy\n"},
	}}

	o, clk := newTestOrchestrator(seq)
	err := o.waitHealthy(context.Background(), HealthTarget{
		Container: "alfheim_zitadel", Label: "Zitadel", Timeout: time.Minute,
	})
	if err != nil {
		t.Fatalf("waitHealthy() error = %v, want the container to be seen as ready", err)
	}
	if seq.calls != 4 {
		t.Fatalf("probed %d times, want 4", seq.calls)
	}
	if clk.sleeps != 3 {
		t.Fatalf("slept %d times, want 3 (one between each probe)", clk.sleeps)
	}
}

func TestWaitHealthy_CancelledContext(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.Fallback = runner.Result{ExitCode: 0, Stdout: "running|starting\n"}

	ctx, cancel := context.WithCancel(context.Background())
	clk := newFakeClock()
	clk.cancelAfter = 2
	clk.cancel = cancel

	o := New(rec, testLayout, WithClock(clk))
	err := o.waitHealthy(ctx, HealthTarget{
		Container: "x", Label: "X", Timeout: time.Hour,
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v, want context.Canceled", err)
	}
}

func TestWaitHealthy_InspectError(t *testing.T) {
	rec := runner.NewRecording(nil)
	rec.ScriptError(inspectKey("x"), errors.New("daemon gone"))

	o, _ := newTestOrchestrator(rec)
	err := o.waitHealthy(context.Background(), HealthTarget{
		Container: "x", Label: "X", Timeout: time.Minute,
	})
	if err == nil || !strings.Contains(err.Error(), "inspect x") {
		t.Fatalf("error = %v", err)
	}
}

func TestRunPhase_LogsProgress(t *testing.T) {
	var log strings.Builder
	o := New(healthyRunner(), testLayout, WithClock(newFakeClock()), WithLogger(&log))
	if err := runBothPhases(context.Background(), o); err != nil {
		t.Fatal(err)
	}
	out := log.String()
	for _, want := range []string{"Edge & Identity", "Core & Application Stack", "is ready"} {
		if !strings.Contains(out, want) {
			t.Errorf("progress log is missing %q; got:\n%s", want, out)
		}
	}
}

func TestRunPhase_NoLoggerIsSilentlyIgnored(t *testing.T) {
	o := New(healthyRunner(), testLayout, WithClock(newFakeClock()))
	if err := o.RunPhase(context.Background(), PhaseEdgeAuth); err != nil {
		t.Fatal(err)
	}
	_ = io.Discard
}

func TestRunPhase_ExplainsZitadelMachinekeyFailure(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult(inspectKey("alfheim_zitadel"),
		runner.Result{ExitCode: 0, Stdout: "running|unhealthy\n"})
	rec.ScriptResult("docker logs --tail 200 alfheim_zitadel", runner.Result{
		ExitCode: 0,
		Stderr:   "migration failed: open /machinekey/pat.txt: permission denied name=03_default_instance",
	})

	o, _ := newTestOrchestrator(rec)
	err := o.RunPhase(context.Background(), PhaseEdgeAuth)
	if err == nil {
		t.Fatal("RunPhase() error = nil, want the unhealthy container to fail")
	}
	if !strings.Contains(err.Error(), "chown 1000:1000") {
		t.Errorf("error = %v, want the machinekey permission explanation", err)
	}
	if !strings.Contains(err.Error(), "Zitadel") {
		t.Errorf("error = %v, want it to still name the failing service", err)
	}
}

func TestRunPhase_LeavesUnrelatedZitadelFailureUnexplained(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult(inspectKey("alfheim_zitadel"),
		runner.Result{ExitCode: 0, Stdout: "running|unhealthy\n"})
	rec.ScriptResult("docker logs --tail 200 alfheim_zitadel",
		runner.Result{ExitCode: 0, Stdout: "some unrelated startup error\n"})

	o, _ := newTestOrchestrator(rec)
	err := o.RunPhase(context.Background(), PhaseEdgeAuth)
	if err == nil {
		t.Fatal("RunPhase() error = nil, want the unhealthy container to fail")
	}
	if strings.Contains(err.Error(), "chown 1000:1000") {
		t.Errorf("error = %v, want no machinekey explanation for an unrelated failure", err)
	}
}

func TestRunPhase_LogFetchFailureFallsBackToOriginalError(t *testing.T) {
	rec := healthyRunner()
	rec.ScriptResult(inspectKey("alfheim_zitadel"),
		runner.Result{ExitCode: 0, Stdout: "running|unhealthy\n"})
	rec.ScriptError("docker logs --tail 200 alfheim_zitadel", errors.New("docker vanished"))

	o, _ := newTestOrchestrator(rec)
	err := o.RunPhase(context.Background(), PhaseEdgeAuth)
	if err == nil {
		t.Fatal("RunPhase() error = nil, want the unhealthy container to fail")
	}
	if !strings.Contains(err.Error(), "Zitadel") {
		t.Errorf("error = %v, want the original error preserved when logs cannot be fetched", err)
	}
}

func TestTrimForError(t *testing.T) {
	if got := trimForError("short"); got != "short" {
		t.Errorf("trimForError(short) = %q", got)
	}
	long := strings.Repeat("x", 800)
	if got := trimForError(long); len(got) != 500 {
		t.Errorf("trimForError length = %d, want 500", len(got))
	}
}

func contains(haystack []string, needle string) bool {
	return indexOf(haystack, needle) >= 0
}

func indexOf(haystack []string, needle string) int {
	for i, s := range haystack {
		if s == needle {
			return i
		}
	}
	return -1
}
