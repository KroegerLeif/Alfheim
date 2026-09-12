package runner

import (
	"context"
	"fmt"
	"io"
	"strings"
)

// mutatingVerbs are the docker compose sub-commands that change host state.
// Everything else (version, inspect, ps) is read-only and stays live during a
// dry run so that host inspection still reports the truth.
var mutatingVerbs = map[string]bool{
	"up": true, "down": true, "pull": true, "start": true,
	"stop": true, "restart": true, "rm": true, "create": true,
}

// DryRunRunner wraps another Runner, executing read-only commands for real but
// only logging the ones that would mutate host state. Implementing --dry-run
// as a decorator keeps conditional branches out of the orchestrator.
type DryRunRunner struct {
	inner Runner
	log   io.Writer
	rec   *RecordingRunner
}

// NewDryRun wraps inner, reporting skipped commands to log.
func NewDryRun(inner Runner, log io.Writer) *DryRunRunner {
	return &DryRunRunner{inner: inner, log: log, rec: NewRecording(nil)}
}

// Run executes read-only commands and skips mutating ones.
func (r *DryRunRunner) Run(ctx context.Context, cmd Command) (Result, error) {
	if _, err := r.rec.Run(ctx, cmd); err != nil {
		return Result{}, err
	}

	if !r.isMutating(cmd) {
		return r.inner.Run(ctx, cmd)
	}
	if r.log != nil {
		fmt.Fprintf(r.log, "[dry-run] would execute: %s\n", cmd.String())
	}
	return Result{ExitCode: 0, Stdout: ""}, nil
}

// valueFlags are the docker/compose flags that consume the following
// argument, so that a value such as "-f up.yaml" is never mistaken for a verb.
var valueFlags = map[string]bool{
	"-f": true, "--file": true,
	"-p": true, "--project-name": true,
	"--project-directory": true, "--env-file": true,
	"--profile": true, "-H": true, "--host": true,
}

// isMutating reports whether cmd would change host state. It walks the
// arguments, skipping flags and the values they consume, and looks for the
// first positional word that names a mutating Compose verb.
func (r *DryRunRunner) isMutating(cmd Command) bool {
	skipNext := false
	for _, arg := range cmd.Args {
		if skipNext {
			skipNext = false
			continue
		}
		if strings.HasPrefix(arg, "-") {
			// "--file=x.yaml" carries its value inline and consumes nothing.
			if valueFlags[arg] {
				skipNext = true
			}
			continue
		}
		if arg == "compose" {
			continue
		}
		return mutatingVerbs[arg]
	}
	return false
}

// LookPath delegates to the wrapped Runner.
func (r *DryRunRunner) LookPath(binary string) (string, error) {
	return r.inner.LookPath(binary)
}

// Calls returns every command the dry run observed, executed or skipped.
func (r *DryRunRunner) Calls() []Command { return r.rec.Calls() }
