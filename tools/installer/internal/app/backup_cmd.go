package app

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"alfheim/installer/internal/features/backup"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// backupUsage documents the `backup` subcommand.
const backupUsage = `alfheim-setup backup - archive the database, media and secrets of an installation

Usage:
  alfheim-setup backup [--output DIR] [--keep N] [--skip-media] [--install-dir DIR]

Writes one timestamped alfheim-backup-<UTC>.tar.gz (mode 0600) holding a
pg_dumpall of every database, the RustFS object storage, .env, the Zitadel
machinekey, the root CA / Caddy PKI and the stack files, plus a manifest with
checksums. The archive contains every secret of the installation in
plaintext: keep it private and encrypt it before it leaves the host.

The stack must be running (the dump is taken through the postgres-core
container).

Flags:
  --output DIR         ALFHEIM_BACKUP_DIR    Directory for archives (default:
                                             <install-dir>/backups, created 0700).
  --keep N                                   Keep the N newest archives (default 7).
  --skip-media                               Leave the RustFS object storage out.
  --install-dir DIR    ALFHEIM_INSTALL_DIR   Installation root (default: the
                                             current directory).

Exit codes:
  0 success   1 failure   2 usage error
`

// BackupOptions are the parsed `backup` subcommand flags.
type BackupOptions struct {
	InstallDir string
	Output     string
	Keep       int
	SkipMedia  bool
}

// ParseBackupOptions parses the `backup` subcommand's arguments.
func ParseBackupOptions(args []string, stderr io.Writer) (*BackupOptions, error) {
	opts := &BackupOptions{}
	fs := flag.NewFlagSet("alfheim-setup backup", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, backupUsage) }
	fs.StringVar(&opts.InstallDir, "install-dir", "", "installation root")
	fs.StringVar(&opts.Output, "output", "", "archive directory")
	fs.IntVar(&opts.Keep, "keep", backup.DefaultKeep, "number of archives to keep")
	fs.BoolVar(&opts.SkipMedia, "skip-media", false, "leave the RustFS object storage out")
	if err := fs.Parse(args); err != nil {
		return nil, fmt.Errorf("alfheim-setup backup: %w", err)
	}
	if fs.NArg() > 0 {
		fmt.Fprint(stderr, backupUsage)
		return nil, fmt.Errorf("alfheim-setup backup: unexpected argument %q", fs.Arg(0))
	}
	if opts.Keep < 1 {
		return nil, fmt.Errorf("alfheim-setup backup: --keep must be at least 1, got %d", opts.Keep)
	}
	if err := resolveInstallDir(&opts.InstallDir, "backup"); err != nil {
		return nil, err
	}
	if opts.Output == "" {
		opts.Output = strings.TrimSpace(os.Getenv("ALFHEIM_BACKUP_DIR"))
	}
	return opts, nil
}

// resolveInstallDir fills dir from ALFHEIM_INSTALL_DIR or the working
// directory when the flag was not given.
func resolveInstallDir(dir *string, command string) error {
	if *dir == "" {
		*dir = strings.TrimSpace(os.Getenv("ALFHEIM_INSTALL_DIR"))
	}
	if *dir == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("alfheim-setup %s: resolve working directory: %w", command, err)
		}
		*dir = cwd
	}
	return nil
}

// BackupApp is the assembled `alfheim-setup backup` command.
type BackupApp struct {
	Options *BackupOptions
	Build   BuildInfo
	Runner  runner.Runner
	Stdout  io.Writer
	Stderr  io.Writer
	Now     func() time.Time
}

// RunBackup parses args and runs the `backup` subcommand, returning a
// process exit code.
func RunBackup(args []string, stdout, stderr io.Writer, build BuildInfo) int {
	opts, err := ParseBackupOptions(args, stderr)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitUsage
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	a := &BackupApp{Options: opts, Build: build, Runner: runner.NewExec(), Stdout: stdout, Stderr: stderr}
	return a.Run(ctx)
}

// Run performs the backup and returns a process exit code.
func (b *BackupApp) Run(ctx context.Context) int {
	if err := b.execute(ctx); err != nil {
		if errors.Is(err, context.Canceled) {
			fmt.Fprintln(b.Stderr, "\nInterrupted.")
			return ExitInterrupt
		}
		fmt.Fprintf(b.Stderr, "Error: %v\n", err)
		return ExitFailure
	}
	return ExitOK
}

func (b *BackupApp) execute(ctx context.Context) error {
	layout, err := paths.New(b.Options.InstallDir)
	if err != nil {
		return err
	}
	if _, err := os.Stat(layout.EnvFile()); err != nil {
		return fmt.Errorf("alfheim-setup backup: no installation found at %s (no .env): %w", layout.Root, err)
	}
	out := b.Options.Output
	if out == "" {
		out = layout.BackupDir()
	}
	svc := backup.New(b.Runner, layout, b.Build.Version, b.Stdout)
	svc.Now = b.Now
	path, err := svc.Create(ctx, backup.CreateOptions{
		OutputDir: out, Keep: b.Options.Keep, IncludeMedia: !b.Options.SkipMedia,
	})
	if err != nil {
		return fmt.Errorf("alfheim-setup backup: %w", err)
	}
	fmt.Fprintf(b.Stdout, "\nBackup written to %s\n"+
		"It contains all secrets in plaintext (mode 0600). Copy it off this host; see docs/en/how-to/backup-restore.md.\n", path)
	return nil
}
