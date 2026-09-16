package bootstrap

import (
	"context"
	"fmt"
	"io"

	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

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
			return err
		}
	}
	return nil
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
