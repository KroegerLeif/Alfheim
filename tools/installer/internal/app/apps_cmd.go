package app

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/features/bootstrap"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// appsUsage documents the `apps` subcommand.
const appsUsage = `alfheim-setup apps - list, enable and disable optional apps

Usage:
  alfheim-setup apps list              [--install-dir DIR]
  alfheim-setup apps enable  <name>    [--install-dir DIR]
  alfheim-setup apps disable <name>    [--install-dir DIR]

The Lean Core (dashboard, household and the infrastructure) always runs.
Every other app, and telemetry, can be switched on and off; the choice is
stored as ALFHEIM_ENABLED_APPS in .env. Disabling an app stops and removes
its containers only: its volumes and its database are kept.

Flags:
  --install-dir DIR    ALFHEIM_INSTALL_DIR   Installation root (default: the
                                             current directory).

Exit codes:
  0 success   1 failure   2 usage error
`

// ServiceStarter is the part of the compose orchestrator the apps command
// needs. It is an interface so tests never start a container.
type ServiceStarter interface {
	StartServices(ctx context.Context, services []string) error
	RemoveServices(ctx context.Context, services []string) error
}

// composeApplier implements apps.Applier on top of the compose orchestrator.
type composeApplier struct {
	orch ServiceStarter
}

// Enable starts the app's services.
func (c composeApplier) Enable(ctx context.Context, app apps.App, _ apps.Set) error {
	return c.orch.StartServices(ctx, app.Services)
}

// Disable stops and removes the app's containers, keeping its data.
func (c composeApplier) Disable(ctx context.Context, app apps.App, _ apps.Set) error {
	return c.orch.RemoveServices(ctx, app.Services)
}

// AppsCommand is the assembled `apps` subcommand. Its Applier is injected,
// so the command never constructs the orchestrator itself.
type AppsCommand struct {
	Layout  paths.Layout
	Applier apps.Applier
	Stdout  io.Writer
	Stderr  io.Writer
}

// RunApps is the composition root of the `apps` subcommand: it parses the
// arguments, wires the real orchestrator and returns the exit code.
func RunApps(args []string, stdout, stderr io.Writer) int {
	action, name, installDir, err := parseAppsArgs(args, stderr)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitUsage
	}
	layout, err := paths.New(installDir)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitFailure
	}
	orch := bootstrap.New(runner.NewExec(), layout, bootstrap.WithLogger(stdout))
	cmd := &AppsCommand{Layout: layout, Applier: composeApplier{orch: orch}, Stdout: stdout, Stderr: stderr}
	return cmd.Run(context.Background(), action, name)
}

// Run executes one action and returns the exit code.
func (c *AppsCommand) Run(ctx context.Context, action, name string) int {
	svc := &apps.Service{
		Store:   apps.EnvFileStore{Path: c.Layout.EnvFile()},
		Applier: c.Applier,
		Out:     c.Stdout,
	}
	var err error
	switch action {
	case "list":
		err = c.list(svc)
	case "enable":
		err = svc.Enable(ctx, name)
	case "disable":
		err = svc.Disable(ctx, name)
	}
	if err != nil {
		fmt.Fprintf(c.Stderr, "Error: %v\n", err)
		return ExitFailure
	}
	return ExitOK
}

// list prints every app with its tier and state.
func (c *AppsCommand) list(svc *apps.Service) error {
	rows, err := svc.List()
	if err != nil {
		return err
	}
	tw := tabwriter.NewWriter(c.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "APP\tTIER\tSTATE\tNOTES")
	for _, r := range rows {
		state := "disabled"
		if r.Enabled {
			state = "enabled"
		}
		notes := ""
		if len(r.App.Requires) > 0 {
			notes = "requires " + strings.Join(r.App.Requires, ", ")
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\n", r.App.Name, r.App.Tier, state, notes)
	}
	return tw.Flush()
}

// parseAppsArgs splits `apps <action> [name] [--install-dir DIR]`.
func parseAppsArgs(args []string, stderr io.Writer) (action, name, installDir string, err error) {
	fs := flag.NewFlagSet("alfheim-setup apps", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, appsUsage) }
	dir := fs.String("install-dir", "", "installation root")

	// Accept the flag before or after the positional arguments.
	var positional []string
	rest := args
	for {
		if err := fs.Parse(rest); err != nil {
			return "", "", "", err
		}
		if fs.NArg() == 0 {
			break
		}
		positional = append(positional, fs.Arg(0))
		rest = fs.Args()[1:]
	}

	if len(positional) == 0 {
		fmt.Fprint(stderr, appsUsage)
		return "", "", "", fmt.Errorf("alfheim-setup apps: missing action (list, enable or disable)")
	}
	action = positional[0]
	switch action {
	case "list":
		if len(positional) != 1 {
			return "", "", "", fmt.Errorf("alfheim-setup apps list: unexpected argument %q", positional[1])
		}
	case "enable", "disable":
		if len(positional) != 2 {
			return "", "", "", fmt.Errorf("alfheim-setup apps %s: expected exactly one app name", action)
		}
		name = strings.ToLower(positional[1])
	default:
		fmt.Fprint(stderr, appsUsage)
		return "", "", "", fmt.Errorf("alfheim-setup apps: unknown action %q", action)
	}

	installDir = firstNonEmpty(*dir, strings.TrimSpace(os.Getenv("ALFHEIM_INSTALL_DIR")))
	if installDir == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return "", "", "", fmt.Errorf("alfheim-setup apps: resolve working directory: %w", err)
		}
		installDir = cwd
	}
	return action, name, installDir, nil
}
