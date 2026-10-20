package app

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"alfheim/installer/internal/features/backup"
	"alfheim/installer/internal/features/bootstrap"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// restoreUsage documents the `restore` subcommand.
const restoreUsage = `alfheim-setup restore - restore an installation from a backup archive

Usage:
  alfheim-setup restore <archive> [--install-dir DIR] [--yes]

Verifies the archive against its manifest, then REPLACES the installation at
--install-dir: .env and the other secrets are overwritten (the previous
copies are saved under .alfheim-backups/), every database and role is dropped
and recreated from the dump, and the RustFS object storage is wiped and
refilled. The stack is stopped during the restore and started again at the
end, followed by scripts/verify-stack.sh.

The cleanest path is a fresh host: install Docker, copy alfheim-setup and the
archive over, and run restore into an empty directory.

Flags:
  --install-dir DIR    ALFHEIM_INSTALL_DIR   Installation root (default: the
                                             current directory).
  --yes                                      Skip the confirmation prompt.

Exit codes:
  0 success   1 failure   2 usage error
`

// RestoreOptions are the parsed `restore` subcommand flags.
type RestoreOptions struct {
	Archive    string
	InstallDir string
	Yes        bool
}

// ParseRestoreOptions parses the `restore` arguments. The archive may come
// before or after the flags.
func ParseRestoreOptions(args []string, stderr io.Writer) (*RestoreOptions, error) {
	opts := &RestoreOptions{}
	fs := flag.NewFlagSet("alfheim-setup restore", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, restoreUsage) }
	fs.StringVar(&opts.InstallDir, "install-dir", "", "installation root")
	fs.BoolVar(&opts.Yes, "yes", false, "skip the confirmation prompt")

	var positional []string
	rest := args
	for {
		if err := fs.Parse(rest); err != nil {
			return nil, fmt.Errorf("alfheim-setup restore: %w", err)
		}
		if fs.NArg() == 0 {
			break
		}
		positional = append(positional, fs.Arg(0))
		rest = fs.Args()[1:]
	}
	if len(positional) != 1 {
		fmt.Fprint(stderr, restoreUsage)
		return nil, fmt.Errorf("alfheim-setup restore: expected exactly one archive path, got %d", len(positional))
	}
	opts.Archive = positional[0]
	if err := resolveInstallDir(&opts.InstallDir, "restore"); err != nil {
		return nil, err
	}
	return opts, nil
}

// RestoreApp is the assembled `alfheim-setup restore` command.
type RestoreApp struct {
	Options *RestoreOptions
	Build   BuildInfo
	Runner  runner.Runner
	Stdout  io.Writer
	Stderr  io.Writer
	// Stdin feeds the confirmation prompt. Defaults to os.Stdin.
	Stdin io.Reader
	Now   func() time.Time
}

// RunRestore parses args and runs the `restore` subcommand, returning a
// process exit code.
func RunRestore(args []string, stdout, stderr io.Writer, build BuildInfo) int {
	opts, err := ParseRestoreOptions(args, stderr)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitUsage
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	a := &RestoreApp{Options: opts, Build: build, Runner: runner.NewExec(), Stdout: stdout, Stderr: stderr}
	return a.Run(ctx)
}

// Run performs the restore and returns a process exit code.
func (r *RestoreApp) Run(ctx context.Context) int {
	if err := r.execute(ctx); err != nil {
		if errors.Is(err, context.Canceled) {
			fmt.Fprintln(r.Stderr, "\nInterrupted.")
			return ExitInterrupt
		}
		fmt.Fprintf(r.Stderr, "Error: %v\n", err)
		return ExitFailure
	}
	return ExitOK
}

func (r *RestoreApp) confirm(prompt string) (bool, error) {
	if r.Options.Yes {
		return true, nil
	}
	in := r.Stdin
	if in == nil {
		in = os.Stdin
	}
	fmt.Fprintf(r.Stdout, "%s [y/N] ", prompt)
	line, err := bufio.NewReader(in).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return false, fmt.Errorf("alfheim-setup restore: read confirmation: %w", err)
	}
	line = strings.TrimSpace(strings.ToLower(line))
	return line == "y" || line == "yes", nil
}

func (r *RestoreApp) execute(ctx context.Context) error {
	layout, err := paths.New(r.Options.InstallDir)
	if err != nil {
		return err
	}
	prepared, err := backup.Prepare(r.Options.Archive, layout.Root)
	if err != nil {
		return fmt.Errorf("alfheim-setup restore: %w", err)
	}
	defer func() { _ = prepared.Cleanup() }()

	m := prepared.Manifest
	fmt.Fprintf(r.Stdout, "%s\nInstallation root: %s\n", r.Build, layout.Root)
	fmt.Fprintf(r.Stdout, "Archive verified: taken %s, release %s, PostgreSQL %s, object storage %s.\n\n",
		m.CreatedAt.Format(time.RFC3339), orDefault(m.ImageTag, "unknown"), orDefault(m.PostgresVersion, "unknown"),
		map[bool]string{true: "included", false: "not included"}[m.IncludesMedia])
	fmt.Fprintf(r.Stdout, "This REPLACES .env and all secrets, DROPS and recreates every database%s in %s.\n"+
		"Current data is lost; run `alfheim-setup backup` first if you may need it.\n",
		map[bool]string{true: " and the object storage", false: ""}[m.IncludesMedia], layout.Root)
	ok, err := r.confirm("Restore this backup now?")
	if err != nil {
		return err
	}
	if !ok {
		fmt.Fprintln(r.Stdout, "Aborted; nothing was changed.")
		return nil
	}

	svc := backup.New(r.Runner, layout, r.Build.Version, r.Stdout)
	svc.Now = r.Now
	orch := bootstrap.New(r.Runner, layout, bootstrap.WithLogger(r.Stdout))

	if _, err := os.Stat(layout.ComposeFile()); err == nil {
		fmt.Fprintln(r.Stdout, "Stopping the stack...")
		if err := r.compose(ctx, layout, "stop"); err != nil {
			return fmt.Errorf("alfheim-setup restore: stop the stack: %w", err)
		}
	}
	fmt.Fprintln(r.Stdout, "Restoring files...")
	safety, err := svc.RestoreFiles(prepared)
	if err != nil {
		return fmt.Errorf("alfheim-setup restore: %w", err)
	}
	fmt.Fprintf(r.Stdout, "Previous versions of overwritten files were saved to %s\n", safety)

	if err := orch.EnsureDatabases(ctx); err != nil {
		return fmt.Errorf("alfheim-setup restore: start the database: %w", err)
	}
	if err := svc.RestoreDatabase(ctx, prepared); err != nil {
		return fmt.Errorf("alfheim-setup restore: %w", err)
	}
	if err := svc.RestoreMedia(ctx, prepared); err != nil {
		return fmt.Errorf("alfheim-setup restore: %w", err)
	}
	if err := orch.UpdateAndRestart(ctx); err != nil {
		return fmt.Errorf("alfheim-setup restore: start the stack: %w", err)
	}
	if err := r.verify(ctx, layout); err != nil {
		return fmt.Errorf("alfheim-setup restore: data restored and stack started, but verification failed: %w", err)
	}
	fmt.Fprintf(r.Stdout, "\nRestore complete (release %s).\n", orDefault(m.ImageTag, "unknown"))
	return nil
}

func (r *RestoreApp) compose(ctx context.Context, layout paths.Layout, args ...string) error {
	res, err := r.Runner.Run(ctx, runner.Command{
		Name: "docker", Args: append([]string{"compose", "-f", layout.ComposeFile()}, args...),
		Dir: layout.Root, Stdout: r.Stdout,
	})
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("docker compose %s exited with code %d: %s", args[0], res.ExitCode, trimOutput(res.Stderr))
	}
	return nil
}

// verify runs scripts/verify-stack.sh from the restored stack files.
func (r *RestoreApp) verify(ctx context.Context, layout paths.Layout) error {
	script := filepath.Join(layout.Root, "scripts", "verify-stack.sh")
	if _, err := os.Stat(script); err != nil {
		fmt.Fprintln(r.Stdout, "Skipping verification: scripts/verify-stack.sh is not present.")
		return nil
	}
	fmt.Fprintln(r.Stdout, "Verifying the running stack...")
	res, err := r.Runner.Run(ctx, runner.Command{
		Name: "bash", Args: []string{script}, Dir: layout.Root, Stdout: r.Stdout,
	})
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("scripts/verify-stack.sh exited with code %d:\n%s",
			res.ExitCode, trimOutput(res.Stdout+res.Stderr))
	}
	fmt.Fprintln(r.Stdout, "Verification passed.")
	return nil
}
