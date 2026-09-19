package app

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"alfheim/installer/internal/features/bootstrap"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/updater"
	"alfheim/installer/internal/shared/assets"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/mode"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
)

// UpdateApp is the assembled `alfheim-setup update` command: the one-command
// Day-2 path a fresh install's owner runs on every later release. It never
// runs the configuration wizard and never touches a secret, the generated
// root CA, the Zitadel machinekey/PAT, or a Docker volume — only the
// standalone stack files (internal/shared/assets.StackAssets), the IMAGE_TAG
// line in .env, and whatever backfillSecrets/provisionZitadel already do for
// a plain no-flag re-run.
type UpdateApp struct {
	Options *UpdateOptions
	Build   BuildInfo
	Runner  runner.Runner
	Stdout  io.Writer
	Stderr  io.Writer
	// Stdin feeds the confirmation prompt. Defaults to os.Stdin; tests
	// inject a strings.Reader (or set Options.Yes to skip the prompt).
	Stdin io.Reader

	// Provisioner reconciles Zitadel, exactly like App.Provisioner.
	// Injectable for tests; defaults to DefaultProvisioner.
	Provisioner Provisioner
	// Now supplies the backup timestamp. Injectable for tests.
	Now func() time.Time
	// Get fetches a URL's content. Injectable for tests; defaults to
	// updater.Fetcher{}.Get.
	Get updater.Getter
	// BaseURL overrides the computed release download base URL
	// (https://github.com/<repo>/releases/download/<version> by default).
	// Test-only: points FetchAssets at an httptest.Server instead.
	BaseURL string
}

// RunUpdate parses args and runs the `update` subcommand, returning a
// process exit code. It is the entry point cmd/alfheim-setup dispatches to,
// the same way it dispatches to RunProvision for the hidden `provision`
// subcommand.
func RunUpdate(args []string, stdout, stderr io.Writer, build BuildInfo) int {
	opts, err := ParseUpdateOptions(args, stderr)
	if err != nil {
		fmt.Fprintf(stderr, "Error: %v\n", err)
		return ExitUsage
	}
	application := &UpdateApp{
		Options: opts,
		Build:   build,
		Runner:  runner.NewExec(),
		Stdout:  stdout,
		Stderr:  stderr,
	}
	return application.Run(context.Background())
}

// Run performs the update and returns a process exit code.
func (u *UpdateApp) Run(ctx context.Context) int {
	if err := u.execute(ctx); err != nil {
		if errors.Is(err, context.Canceled) {
			fmt.Fprintln(u.Stderr, "\nInterrupted.")
			return ExitInterrupt
		}
		fmt.Fprintf(u.Stderr, "Error: %v\n", err)
		return ExitFailure
	}
	return ExitOK
}

// execute is the update proper.
func (u *UpdateApp) execute(ctx context.Context) error {
	layout, err := paths.New(u.Options.InstallDir)
	if err != nil {
		return err
	}

	// mode.Detect with reconfigure=false reports ModeUpdate exactly when the
	// Day-1 completion marker is present, which is the same "does an install
	// already exist here" test the plain no-flag path relies on.
	m, err := mode.Detect(layout, false)
	if err != nil {
		return err
	}
	if m != mode.ModeUpdate {
		return fmt.Errorf(
			"alfheim-setup update: no existing installation found at %s (no %s marker). "+
				"Run alfheim-setup without \"update\" for a first install.",
			layout.Root, paths.MarkerName)
	}

	existing, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		return fmt.Errorf("alfheim-setup update: read .env: %w", err)
	}

	target := firstNonEmpty(u.Options.Version, u.Build.Version)
	if target == "" || target == "dev" {
		return fmt.Errorf(
			"alfheim-setup update: no target version: pass --version vX.Y.Z (this binary was " +
				"not built with a release version, so it cannot infer one; it never defaults to \"latest\")")
	}

	previousTag := existing["IMAGE_TAG"]
	fmt.Fprintf(u.Stdout, "%s\nInstallation root: %s\n", u.Build, layout.Root)
	fmt.Fprintf(u.Stdout, "Updating from %s to %s\n\n", orDefault(previousTag, "unknown"), target)

	ok, err := u.confirm(fmt.Sprintf("Continue updating %s to %s?", layout.Root, target))
	if err != nil {
		return err
	}
	if !ok {
		fmt.Fprintln(u.Stdout, "Aborted; nothing was changed.")
		return nil
	}

	baseURL := u.baseURL(target)
	fmt.Fprintf(u.Stdout, "Downloading and verifying stack assets for %s...\n", target)
	content, err := updater.FetchAssets(ctx, u.get(), baseURL, assets.StackAssets)
	if err != nil {
		return fmt.Errorf("alfheim-setup update: %w", err)
	}

	backupDir, err := updater.Backup(layout.Root, assets.StackAssets, u.now())
	if err != nil {
		return fmt.Errorf("alfheim-setup update: back up the previous stack files: %w", err)
	}
	fmt.Fprintf(u.Stdout, "Backed up the previous stack files to %s\n", backupDir)

	if err := updater.Replace(layout.Root, assets.StackAssets, content); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, fmt.Errorf("replace stack files: %w", err))
	}
	fmt.Fprintln(u.Stdout, "Replaced compose.prod.yaml and the other stack assets.")

	if err := envfile.Update(layout.EnvFile(), map[string]string{"IMAGE_TAG": target}); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, fmt.Errorf("set IMAGE_TAG in .env: %w", err))
	}
	fmt.Fprintf(u.Stdout, "Set IMAGE_TAG=%s in .env\n", target)

	existing, err = envfile.ParseFile(layout.EnvFile())
	if err != nil {
		return u.rollbackError(backupDir, previousTag, layout, fmt.Errorf("re-read .env: %w", err))
	}
	warnPlainHTTPInstall(u.Stderr, existing)

	if err := backfillSecrets(u.Stdout, layout, existing); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, err)
	}

	on, err := onboarding.HeadlessConfigFromEnv(existing)
	if err != nil {
		return u.rollbackError(backupDir, previousTag, layout, err)
	}
	if err := provisionZitadel(ctx, u.Stdout, u.provisioner(), layout, on); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, err)
	}

	orch := bootstrap.New(u.Runner, layout, bootstrap.WithLogger(u.Stdout))
	if err := orch.EnsureDatabases(ctx); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, err)
	}
	if err := orch.UpdateAndRestart(ctx); err != nil {
		return u.rollbackError(backupDir, previousTag, layout, err)
	}

	if err := u.runVerify(ctx, layout); err != nil {
		return u.rollbackError(backupDir, previousTag, layout,
			fmt.Errorf("verification failed after restart: %w", err))
	}

	fmt.Fprintf(u.Stdout, "\nAlfheim was updated to %s.\n"+
		"  Previous stack files were backed up to %s.\n",
		target, backupDir)
	return nil
}

// rollbackError wraps cause with the concrete steps to undo an update that
// failed partway through, once the backup already exists on disk.
func (u *UpdateApp) rollbackError(backupDir, previousTag string, layout paths.Layout, cause error) error {
	tag := orDefault(previousTag, "<the previous value — see infrastructure files under "+backupDir+">")
	return fmt.Errorf("%w\n\n"+
		"To roll back:\n"+
		"  1. Copy the files under %s back over their current locations "+
		"(for example: cp -r %s/. %s/).\n"+
		"  2. Set IMAGE_TAG=%s in %s.\n"+
		"  3. Run: docker compose -f %s pull && docker compose -f %s up -d --remove-orphans",
		cause, backupDir, backupDir, layout.Root, tag, layout.EnvFile(), layout.ComposeFile(), layout.ComposeFile())
}

// confirm asks the operator to proceed, unless --yes was passed.
func (u *UpdateApp) confirm(prompt string) (bool, error) {
	if u.Options.Yes {
		return true, nil
	}
	in := u.Stdin
	if in == nil {
		in = os.Stdin
	}
	fmt.Fprintf(u.Stdout, "%s [y/N] ", prompt)
	line, err := bufio.NewReader(in).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return false, fmt.Errorf("alfheim-setup update: read confirmation: %w", err)
	}
	line = strings.TrimSpace(strings.ToLower(line))
	return line == "y" || line == "yes", nil
}

// get returns the configured Getter, defaulting to a real HTTP fetch.
func (u *UpdateApp) get() updater.Getter {
	if u.Get != nil {
		return u.Get
	}
	return updater.Fetcher{}.Get
}

// baseURL returns the release's asset base URL, matching install.sh's
// BASE_URL for the same repo and tag.
func (u *UpdateApp) baseURL(version string) string {
	if u.BaseURL != "" {
		return u.BaseURL
	}
	return fmt.Sprintf("https://github.com/%s/releases/download/%s", u.Options.Repo, version)
}

// now returns the backup timestamp.
func (u *UpdateApp) now() time.Time {
	if u.Now != nil {
		return u.Now()
	}
	return time.Now()
}

// provisioner returns the configured Provisioner, defaulting to the real one.
func (u *UpdateApp) provisioner() Provisioner {
	if u.Provisioner != nil {
		return u.Provisioner
	}
	return &DefaultProvisioner{}
}

// runVerify runs scripts/verify-stack.sh against the freshly restarted
// stack, which update just fetched onto disk as one of assets.StackAssets.
// It is skipped, rather than failing the update, when the script is not
// present (for example a local dev checkout that never ran install.sh).
func (u *UpdateApp) runVerify(ctx context.Context, layout paths.Layout) error {
	script := filepath.Join(layout.Root, "scripts", "verify-stack.sh")
	if _, err := os.Stat(script); err != nil {
		fmt.Fprintln(u.Stdout, "Skipping verification: scripts/verify-stack.sh is not present.")
		return nil
	}
	fmt.Fprintln(u.Stdout, "Verifying the running stack...")
	res, err := u.Runner.Run(ctx, runner.Command{
		Name: "bash", Args: []string{script}, Dir: layout.Root, Stdout: u.Stdout,
	})
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("scripts/verify-stack.sh exited with code %d:\n%s",
			res.ExitCode, trimOutput(res.Stdout+res.Stderr))
	}
	fmt.Fprintln(u.Stdout, "Verification passed.")
	return nil
}

// trimOutput shortens command output so an error stays readable.
func trimOutput(s string) string {
	const max = 2000
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
