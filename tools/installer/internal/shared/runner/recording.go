package runner

import (
	"context"
	"fmt"
	"sync"
)

// RecordingRunner is a test double that records every command it is asked to
// run and replays scripted results. It ships in the production package (rather
// than a _test.go file) so that every feature slice can depend on it.
type RecordingRunner struct {
	mu      sync.Mutex
	calls   []Command
	scripts map[string]Result
	errs    map[string]error
	paths   map[string]string
	// Fallback is returned for commands with no scripted result.
	Fallback Result
	// StrictLookPath makes LookPath fail for binaries absent from paths.
	StrictLookPath bool
}

// NewRecording returns a RecordingRunner replaying the supplied results. The
// map is keyed on Command.String().
func NewRecording(scripts map[string]Result) *RecordingRunner {
	if scripts == nil {
		scripts = map[string]Result{}
	}
	return &RecordingRunner{
		scripts: scripts,
		errs:    map[string]error{},
		paths:   map[string]string{},
	}
}

// ScriptError makes the command identified by key fail with err.
func (r *RecordingRunner) ScriptError(key string, err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.errs[key] = err
}

// ScriptResult registers or replaces the result for key.
func (r *RecordingRunner) ScriptResult(key string, res Result) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scripts[key] = res
}

// SetPath registers a binary as present on PATH.
func (r *RecordingRunner) SetPath(binary, path string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.paths[binary] = path
}

// Run records cmd and returns its scripted result.
func (r *RecordingRunner) Run(_ context.Context, cmd Command) (Result, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.calls = append(r.calls, cmd)
	key := cmd.String()

	if err, ok := r.errs[key]; ok {
		return Result{}, err
	}
	if res, ok := r.scripts[key]; ok {
		return res, nil
	}
	return r.Fallback, nil
}

// LookPath reports registered binaries.
func (r *RecordingRunner) LookPath(binary string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if path, ok := r.paths[binary]; ok {
		return path, nil
	}
	if r.StrictLookPath {
		return "", fmt.Errorf("runner: %q not found in $PATH", binary)
	}
	return "/usr/bin/" + binary, nil
}

// Calls returns a copy of every command recorded so far, in order.
func (r *RecordingRunner) Calls() []Command {
	r.mu.Lock()
	defer r.mu.Unlock()

	out := make([]Command, len(r.calls))
	copy(out, r.calls)
	return out
}

// CallStrings returns the recorded commands in canonical string form.
func (r *RecordingRunner) CallStrings() []string {
	calls := r.Calls()
	out := make([]string, len(calls))
	for i, c := range calls {
		out[i] = c.String()
	}
	return out
}
