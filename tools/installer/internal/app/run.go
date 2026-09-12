package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"alfheim/installer/internal/features/bootstrap"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/security"
	"alfheim/installer/internal/features/templating"
	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/mode"
	"alfheim/installer/internal/shared/paths"
	"alfheim/installer/internal/shared/runner"
	"alfheim/installer/internal/shared/system"
)

// BuildInfo carries the metadata injected at link time.
type BuildInfo struct {
	Version string
	Commit  string
	Date    string
}

// String renders the version banner.
func (b BuildInfo) String() string {
	return fmt.Sprintf("alfheim-setup %s (commit %s, built %s)",
		orUnknown(b.Version), orUnknown(b.Commit), orUnknown(b.Date))
}

func orUnknown(s string) string {
	if s == "" {
		return "dev"
	}
	return s
}

// Wizard collects configuration interactively. It is an interface so the
// headless path and the tests can substitute a non-TUI implementation.
type Wizard interface {
	Run(on *onboarding.Config, tlsCfg *tls.Config) error
	Confirm(ctx context.Context, authURL string) error
}

// App is the assembled installer.
type App struct {
	Options *Options
	Build   BuildInfo
	Runner  runner.Runner
	Wizard  Wizard
	Stdout  io.Writer
	Stderr  io.Writer
	// Now supplies the generation timestamp, injectable for tests.
	Now func() time.Time
}

// Run performs the installation and returns a process exit code.
func (a *App) Run(ctx context.Context) int {
	if a.Options.ShowVersion {
		fmt.Fprintln(a.Stdout, a.Build)
		return ExitOK
	}

	if err := a.execute(ctx); err != nil {
		if errors.Is(err, context.Canceled) {
			fmt.Fprintln(a.Stderr, "\nInterrupted. Containers already started were left running.")
			fmt.Fprintf(a.Stderr, "Resume with: docker compose -f compose.prod.yaml up -d\n")
			return ExitInterrupt
		}
		fmt.Fprintf(a.Stderr, "Error: %v\n", err)
		return ExitFailure
	}
	return ExitOK
}

// execute is the installation proper.
func (a *App) execute(ctx context.Context) error {
	layout, err := paths.New(a.Options.InstallDir)
	if err != nil {
		return err
	}

	current, err := mode.Detect(layout, a.Options.Reconfigure)
	if err != nil {
		return err
	}
	fmt.Fprintf(a.Stdout, "%s\nInstallation root: %s\nMode: %s\n\n",
		a.Build, layout.Root, current)

	if err := a.checkHost(ctx); err != nil {
		return err
	}

	// A plain update needs no configuration: reuse what is on disk.
	if current == mode.ModeUpdate {
		return a.runUpdate(ctx, layout)
	}

	on, tlsCfg, err := a.configure(layout)
	if err != nil {
		return err
	}

	model, target, err := a.renderConfiguration(layout, on, tlsCfg)
	if err != nil {
		return err
	}

	if a.Options.DryRun {
		fmt.Fprintf(a.Stdout, "\nDry run complete. Configuration was rendered to %s.\n", target.Root)
		fmt.Fprintln(a.Stdout, "No container was started and no existing installation was modified.")
		return nil
	}

	return a.runBootstrap(ctx, layout, model)
}

// checkHost inspects the host and refuses to continue when it is not ready.
func (a *App) checkHost(ctx context.Context) error {
	report, err := system.NewInspector(a.Runner).Inspect(ctx)
	if err != nil {
		return err
	}
	if report.OK() {
		fmt.Fprintf(a.Stdout, "Host ready: Docker Compose %s on %s/%s.\n\n",
			report.ComposeVersion, report.OS, report.Arch)
		return nil
	}

	problems := report.Blocking()
	// A dry run still reports the problems, but does not refuse: rendering
	// configuration does not need a working Docker daemon.
	if a.Options.DryRun {
		for _, p := range problems {
			fmt.Fprintf(a.Stderr, "Warning: %s\n", p)
		}
		fmt.Fprintln(a.Stderr, "Continuing anyway because this is a dry run.")
		return nil
	}
	return fmt.Errorf("alfheim-setup: the host is not ready:\n  - %s",
		joinLines(problems))
}

// configure collects the domain and TLS settings.
func (a *App) configure(layout paths.Layout) (onboarding.Config, tls.Config, error) {
	var on onboarding.Config
	var tlsCfg tls.Config
	var err error

	if a.Options.NonInteractive {
		on, tlsCfg, err = a.Options.HeadlessConfig()
	} else {
		onboarding.ApplyPreset(&on, onboarding.PresetLoegien)
		tlsCfg.Strategy = tls.StrategyHetznerDNS
		err = a.Wizard.Run(&on, &tlsCfg)
		if err == nil {
			// A preset may have changed which scheme applies.
			if preset, ok := onboarding.Lookup(on.Preset); ok {
				preset.Apply(&on)
			}
			tlsCfg.ACMEEmail = firstNonEmpty(tlsCfg.ACMEEmail, on.AdminEmail)
		}
	}
	if err != nil {
		return on, tlsCfg, err
	}

	if err := onboarding.Derive(&on); err != nil {
		return on, tlsCfg, err
	}
	if err := onboarding.Validate(on); err != nil {
		return on, tlsCfg, err
	}

	manager := tls.NewManager(layout)
	if err := manager.Resolve(&tlsCfg); err != nil {
		return on, tlsCfg, err
	}
	if err := manager.Validate(&tlsCfg); err != nil {
		return on, tlsCfg, err
	}
	for _, w := range tlsCfg.Warnings {
		fmt.Fprintf(a.Stderr, "Warning: %s\n", w)
	}
	return on, tlsCfg, nil
}

// renderConfiguration generates secrets and writes .env and the Caddyfile.
// It returns the layout actually written to, which for a dry run is a
// temporary directory rather than the installation root.
func (a *App) renderConfiguration(
	layout paths.Layout, on onboarding.Config, tlsCfg tls.Config,
) (templating.Model, paths.Layout, error) {
	// Carry forward any secret an earlier run generated.
	existing := map[string]string{}
	if previous, err := envfile.ParseFile(layout.EnvFile()); err == nil {
		existing = previous
	} else if !errors.Is(err, os.ErrNotExist) && !os.IsNotExist(errors.Unwrap(err)) {
		fmt.Fprintf(a.Stderr, "Warning: could not read the existing .env: %v\n", err)
	}

	secrets, err := security.GenerateAll(security.NewGenerator(), existing)
	if err != nil {
		return templating.Model{}, layout, err
	}

	renderer, err := templating.NewRenderer()
	if err != nil {
		return templating.Model{}, layout, err
	}

	model := templating.Model{
		Onboarding: on,
		TLS:        tlsCfg,
		Secrets:    secrets,
		Version:    orUnknown(a.Build.Version),
		Generated:  a.now(),
	}

	target := layout
	if a.Options.DryRun {
		// A dry run must never touch an existing installation.
		tmp, err := os.MkdirTemp("", "alfheim-dry-run-*")
		if err != nil {
			return model, layout, fmt.Errorf("alfheim-setup: create dry-run directory: %w", err)
		}
		target = paths.Layout{Root: tmp}
	}

	if err := renderer.WriteAll(target, model); err != nil {
		return model, target, err
	}
	fmt.Fprintf(a.Stdout, "Wrote %s\nWrote %s\n", target.EnvFile(), target.Caddyfile())
	return model, target, nil
}

// runBootstrap performs the staged container boot for a fresh install.
func (a *App) runBootstrap(
	ctx context.Context, layout paths.Layout, model templating.Model,
) error {
	orch := bootstrap.New(a.Runner, layout, a.confirmFunc(), bootstrap.WithLogger(a.Stdout))
	orch.AuthURL = model.Onboarding.IssuerURL
	orch.SkipConfirm = a.Options.NonInteractive

	if err := orch.Run(ctx); err != nil {
		return err
	}
	if err := markInstalled(layout, a.Build.Version); err != nil {
		return err
	}

	a.printSummary(model)
	return nil
}

// runUpdate performs the Day-2 path: pull new images and restart.
func (a *App) runUpdate(ctx context.Context, layout paths.Layout) error {
	fmt.Fprintln(a.Stdout, "An existing installation was detected.")
	fmt.Fprintln(a.Stdout, "Updating images and restarting services. "+
		"Re-run with --reconfigure to change the configuration.")

	if a.Options.DryRun {
		fmt.Fprintln(a.Stdout, "Dry run: no container was started.")
		return nil
	}

	orch := bootstrap.New(a.Runner, layout, nil, bootstrap.WithLogger(a.Stdout))
	orch.SkipConfirm = true
	return orch.RunPhase(ctx, bootstrap.PhaseCoreStack)
}

// confirmFunc returns the manual Zitadel onboarding pause.
func (a *App) confirmFunc() bootstrap.ConfirmFunc {
	if a.Options.NonInteractive || a.Wizard == nil {
		return nil
	}
	return a.Wizard.Confirm
}

// printSummary reports how to reach the finished installation.
func (a *App) printSummary(m templating.Model) {
	fmt.Fprintf(a.Stdout, `
Alfheim is up.

  Dashboard       %s
  Identity        %s
  Observability   %s/grafana/

  Credentials are stored in .env (mode 0600).
  Administrator:  %s
`,
		m.Onboarding.BaseURL, m.Onboarding.IssuerURL, m.Onboarding.BaseURL,
		m.Secret("ZITADEL_ADMIN_PASSWORD"))
}

// markInstalled records that a Day-1 install completed.
func markInstalled(l paths.Layout, version string) error {
	content := fmt.Sprintf("version=%s\ninstalled_at=%s\n",
		orUnknown(version), time.Now().UTC().Format(time.RFC3339))
	if err := os.WriteFile(l.Marker(), []byte(content), 0o644); err != nil {
		return fmt.Errorf("alfheim-setup: write installation marker: %w", err)
	}
	return nil
}

// now returns the generation timestamp.
func (a *App) now() time.Time {
	if a.Now != nil {
		return a.Now()
	}
	return time.Now()
}

// firstNonEmpty returns the first non-empty string.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// joinLines renders a bullet list body.
func joinLines(items []string) string {
	out := ""
	for i, item := range items {
		if i > 0 {
			out += "\n  - "
		}
		out += item
	}
	return out
}
