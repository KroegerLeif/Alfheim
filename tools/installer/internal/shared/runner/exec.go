package runner

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"time"
)

// ExecRunner is the production Runner backed by os/exec.
type ExecRunner struct{}

// NewExec returns a Runner that really executes processes on the host.
func NewExec() *ExecRunner { return &ExecRunner{} }

// Run executes cmd, honouring cancellation of ctx so that an interrupt during
// a long "docker compose" call tears the child process down with us.
func (r *ExecRunner) Run(ctx context.Context, cmd Command) (Result, error) {
	started := time.Now()

	proc := exec.CommandContext(ctx, cmd.Name, cmd.Args...)
	proc.Dir = cmd.Dir
	if len(cmd.Env) > 0 {
		proc.Env = append(os.Environ(), cmd.Env...)
	}

	var stdout, stderr bytes.Buffer
	if cmd.Stdout != nil {
		proc.Stdout = io.MultiWriter(&stdout, cmd.Stdout)
	} else {
		proc.Stdout = &stdout
	}
	proc.Stderr = &stderr

	err := proc.Run()
	res := Result{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		Duration: time.Since(started),
	}

	if err != nil {
		// A cancelled context is a real error: the caller is unwinding.
		if ctxErr := ctx.Err(); ctxErr != nil {
			return res, ctxErr
		}
		// A non-zero exit is a normal outcome reported via ExitCode.
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			res.ExitCode = exitErr.ExitCode()
			return res, nil
		}
		return res, err
	}

	res.ExitCode = 0
	return res, nil
}

// LookPath reports the absolute path of a binary on PATH.
func (r *ExecRunner) LookPath(binary string) (string, error) {
	return exec.LookPath(binary)
}
