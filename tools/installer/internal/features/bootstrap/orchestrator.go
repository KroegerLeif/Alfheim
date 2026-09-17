package bootstrap

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// zitadelContainer is the container name PhaseEdgeAuth waits on. It is also
// used to single out Zitadel's own startup failure for a more actionable
// error message.
const zitadelContainer = "alfheim_zitadel"

// Orchestrator drives the staged Docker Compose lifecycle.
type Orchestrator struct {
	runner runner.Runner
	layout paths.Layout
	clock  clock
	log    io.Writer
}

// Option customises an Orchestrator.
type Option func(*Orchestrator)

// WithClock overrides the clock, so tests need not wait in real time.
func WithClock(c clock) Option { return func(o *Orchestrator) { o.clock = c } }

// WithLogger directs progress output to w.
func WithLogger(w io.Writer) Option { return func(o *Orchestrator) { o.log = w } }

// New returns an Orchestrator.
func New(r runner.Runner, l paths.Layout, opts ...Option) *Orchestrator {
	o := &Orchestrator{
		runner: r,
		layout: l,
		clock:  realClock{},
	}
	for _, opt := range opts {
		opt(o)
	}
	return o
}

// RunPhase pulls images, starts the services of one phase and waits for them.
func (o *Orchestrator) RunPhase(ctx context.Context, phase Phase) error {
	o.logf("Phase: %s", phase.Name)

	if err := o.compose(ctx, append([]string{"pull"}, phase.Services...)); err != nil {
		return fmt.Errorf("bootstrap: pull images for %s: %w", phase.Name, err)
	}
	if err := o.compose(ctx, append([]string{"up", "-d"}, phase.Services...)); err != nil {
		return fmt.Errorf("bootstrap: start %s: %w", phase.Name, err)
	}

	for _, target := range phase.WaitFor {
		if err := o.waitHealthy(ctx, target); err != nil {
			if target.Container == zitadelContainer {
				err = o.explainZitadelFailure(ctx, err)
			}
			return err
		}
	}
	return nil
}

// ingressService and ingressTarget identify Caddy in compose.prod.yaml.
const ingressService = "caddy"

var ingressTarget = HealthTarget{
	Container: "alfheim_caddy", Label: "Caddy ingress gateway", Timeout: 90 * time.Second,
}

// RestartIngress restarts Caddy and waits for it to turn healthy again.
//
// The Caddyfile is a bind-mounted file and Caddy runs with its admin API
// off, so a re-rendered Caddyfile is never picked up by `up -d` alone when
// nothing else about the service changed. A reconfigure calls this so a
// changed scheme or TLS strategy takes effect before provisioning talks to
// Zitadel through Caddy.
func (o *Orchestrator) RestartIngress(ctx context.Context) error {
	o.logf("Restarting %s to apply the regenerated Caddyfile", ingressTarget.Label)
	if err := o.compose(ctx, []string{"restart", ingressService}); err != nil {
		return fmt.Errorf("bootstrap: restart %s: %w", ingressService, err)
	}
	return o.waitHealthy(ctx, ingressTarget)
}

// explainZitadelFailure looks at Zitadel's own logs after a startup failure
// and, when they show the machinekey permission problem (a bind-mount
// directory Docker created root-owned before the non-root container user
// could write its bootstrap PAT into it), appends a concrete explanation
// instead of leaving the operator with just a timeout or unhealthy message.
// Best-effort: any failure to fetch logs falls back to the original error.
func (o *Orchestrator) explainZitadelFailure(ctx context.Context, original error) error {
	res, err := o.runner.Run(ctx, runner.Command{
		Name: "docker", Args: []string{"logs", "--tail", "200", zitadelContainer},
	})
	if err != nil || res.ExitCode != 0 {
		return original
	}
	if !strings.Contains(res.Stdout+res.Stderr, "open /machinekey/pat.txt") {
		return original
	}
	return fmt.Errorf("%w\n\n"+
		"Zitadel could not write its bootstrap PAT to /machinekey/pat.txt. This is a "+
		"permissions problem: the host directory bind-mounted there was created "+
		"root-owned (by Docker itself) before it could be made writable by the "+
		"container's own user. Fix its ownership (chown 1000:1000 on the machinekey "+
		"directory under your install root) and re-run", original)
}

// compose runs one docker compose sub-command against the production file.
func (o *Orchestrator) compose(ctx context.Context, args []string) error {
	full := append([]string{"compose", "-f", o.layout.ComposeFile()}, args...)

	res, err := o.runner.Run(ctx, runner.Command{
		Name:   "docker",
		Args:   full,
		Dir:    o.layout.Root,
		Stdout: o.log,
	})
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("docker compose %v exited with code %d: %s",
			args, res.ExitCode, trimForError(res.Stderr))
	}
	return nil
}

// logf writes a progress line when a logger is attached.
func (o *Orchestrator) logf(format string, args ...any) {
	if o.log == nil {
		return
	}
	fmt.Fprintf(o.log, format+"\n", args...)
}

// trimForError shortens command output so an error stays readable.
func trimForError(s string) string {
	const max = 500
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
