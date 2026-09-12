// Package runner abstracts external process execution so that Docker Compose
// sequences can be asserted deterministically in tests without a running
// Docker daemon.
package runner

import (
	"context"
	"io"
	"strings"
	"time"
)

// Command describes a single external process invocation.
type Command struct {
	// Name is the executable to run, for example "docker".
	Name string
	// Args are the arguments passed to the executable.
	Args []string
	// Dir is the working directory. An empty value inherits the parent.
	Dir string
	// Env holds additional KEY=VALUE pairs appended to the parent environment.
	Env []string
	// Stdout, when non-nil, receives the streamed standard output of the
	// process. It is used to forward Docker progress into the TUI log pane.
	Stdout io.Writer
}

// String renders the command in shell-like form. It is the canonical key used
// by RecordingRunner to look up scripted results, so its format is part of the
// package contract and must stay stable.
func (c Command) String() string {
	if len(c.Args) == 0 {
		return c.Name
	}
	return c.Name + " " + strings.Join(c.Args, " ")
}

// Result captures the outcome of a finished process.
type Result struct {
	ExitCode int
	Stdout   string
	Stderr   string
	Duration time.Duration
}

// Runner executes commands on the host. Every component that needs to shell
// out depends on this interface rather than on os/exec directly.
type Runner interface {
	// Run executes cmd and returns its result. A non-zero exit code is
	// reported through Result.ExitCode and is not, on its own, an error;
	// an error is returned only when the process could not be run or when
	// ctx was cancelled.
	Run(ctx context.Context, cmd Command) (Result, error)
	// LookPath reports the absolute path of a binary on PATH.
	LookPath(binary string) (string, error)
}
