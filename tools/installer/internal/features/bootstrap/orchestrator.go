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

// postgresService, postgresTarget and dbInitScript identify the core
// database in compose.prod.yaml and the idempotent initializer mounted into
// it (infrastructure/postgres/init-multiple-dbs.sh).
const (
	postgresService = "postgres-core"
	dbInitScript    = "/docker-entrypoint-initdb.d/init-multiple-dbs.sh"
)

var postgresTarget = HealthTarget{
	Container: "alfheim_postgres_core", Label: "PostgreSQL core", Timeout: 120 * time.Second,
}

// EnsureDatabases makes sure every service database and role in
// init-multiple-dbs.sh exists on an existing installation.
//
// Postgres only runs /docker-entrypoint-initdb.d on an empty data volume, so
// a database added in a later release (alfheim_household, for instance)
// would never be created on an upgraded install. The script is idempotent,
// so re-running it against the running server only creates what is missing
// and re-applies the passwords from .env. It must not be called on a fresh
// install: there the entrypoint is still running the same script against a
// socket-only server that pg_isready already reports as ready.
func (o *Orchestrator) EnsureDatabases(ctx context.Context) error {
	o.logf("Ensuring every service database exists")
	// up -d also recreates postgres-core when .env gained a new database
	// credential, so the script below sees it in its environment.
	if err := o.compose(ctx, []string{"up", "-d", postgresService}); err != nil {
		return fmt.Errorf("bootstrap: start %s: %w", postgresService, err)
	}
	if err := o.waitHealthy(ctx, postgresTarget); err != nil {
		return err
	}
	if err := o.compose(ctx, []string{"exec", "-T", postgresService, "bash", dbInitScript}); err != nil {
		return fmt.Errorf("bootstrap: ensure service databases: %w", err)
	}
	return nil
}

// UpdateAndRestart pulls every image compose.prod.yaml now names and
// restarts the whole stack, removing any container for a service the new
// compose file no longer declares (a service renamed or dropped between
// releases would otherwise be left running as an orphan). It then waits for
// every container both staged boot phases wait on, since either Zitadel or
// the core application services may have received a new image.
//
// It is the `alfheim-setup update` subcommand's restart step; a plain
// no-flag re-run instead uses RunPhase(PhaseCoreStack), which never passes
// --remove-orphans because it starts from a compose file that has not
// changed on disk.
func (o *Orchestrator) UpdateAndRestart(ctx context.Context) error {
	o.logf("Pulling images")
	if err := o.compose(ctx, []string{"pull"}); err != nil {
		return fmt.Errorf("bootstrap: pull images: %w", err)
	}
	o.logf("Restarting the stack")
	if err := o.compose(ctx, []string{"up", "-d", "--remove-orphans"}); err != nil {
		return fmt.Errorf("bootstrap: restart the stack: %w", err)
	}

	targets := append(append([]HealthTarget{}, PhaseEdgeAuth.WaitFor...), PhaseCoreStack.WaitFor...)
	for _, target := range targets {
		if err := o.waitHealthy(ctx, target); err != nil {
			if target.Container == zitadelContainer {
				err = o.explainZitadelFailure(ctx, err)
			}
			return err
		}
	}
	return nil
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
