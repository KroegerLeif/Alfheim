// Command alfheim-setup is the interactive installer for Alfheim Sovereign OS.
//
// It is the only file permitted to call os.Exit, so every other package stays
// testable and lint-clean.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"golang.org/x/term"

	"alfheim/installer/internal/app"
	"alfheim/installer/internal/shared/runner"
)

// Build metadata, injected at link time with -ldflags -X.
var (
	version = ""
	commit  = ""
	date    = ""
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run is the real entry point. It returns the process exit code instead of
// terminating, so its behaviour can be asserted in tests.
func run(args []string, stdout, stderr *os.File) int {
	// The hidden `provision` subcommand reconciles Zitadel OIDC clients
	// against an existing .env without the wizard or any container
	// lifecycle; scripts/up.sh calls it via `go run` so the dev stack shares
	// the same reconciliation logic as a production install.
	if len(args) > 0 && args[0] == "provision" {
		return app.RunProvision(args[1:], stdout, stderr)
	}

	// `update` is the Day-2 one-command entry point: fetch a target
	// release's stack assets, back up and replace the previous ones, and
	// restart. Unlike a plain no-flag re-run it never falls back to the
	// wizard, so it is dispatched here rather than through app.Run.
	if len(args) > 0 && args[0] == "update" {
		return app.RunUpdate(args[1:], stdout, stderr, app.BuildInfo{Version: version, Commit: commit, Date: date})
	}

	// Restore the terminal even when we unwind through a signal. An interrupt
	// during a container wait would otherwise leave the operator's shell in
	// raw mode with a hidden cursor.
	defer restoreTerminal(stdout)

	opts, err := app.ParseOptions(args, stderr)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return app.ExitUsage
	}

	ctx, stop := signal.NotifyContext(context.Background(),
		os.Interrupt, syscall.SIGTERM)
	defer stop()

	base := runner.Runner(runner.NewExec())
	if opts.DryRun {
		base = runner.NewDryRun(base, stdout)
	}

	application := &app.App{
		Options: opts,
		Build:   app.BuildInfo{Version: version, Commit: commit, Date: date},
		Runner:  base,
		Wizard:  app.NewTUIWizard(stdout),
		Stdout:  stdout,
		Stderr:  stderr,
	}
	return application.Run(ctx)
}

// restoreTerminal re-enables the cursor and leaves the alternate screen.
func restoreTerminal(out *os.File) {
	if !term.IsTerminal(int(out.Fd())) {
		return
	}
	// Show the cursor, then leave the alternate screen buffer.
	fmt.Fprint(out, "\x1b[?25h\x1b[?1049l")
}
