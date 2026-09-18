package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
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
	// Inspector probes host readiness. Injectable for tests, which must not
	// depend on ports 80 and 443 being free on the build machine. When nil,
	// the real host inspector is used.
	Inspector system.Inspector
	// Provisioner reconciles the Zitadel project and OIDC applications
	// between the Edge & Identity and Core & Application Stack phases.
	// Injectable for tests, which must not depend on a live Zitadel. When
	// nil, DefaultProvisioner is used.
	Provisioner Provisioner
	// MachineKeyPreparer readies the Zitadel machinekey bind-mount directory
	// before the Edge & Identity phase starts Zitadel. Injectable for tests;
	// when its fields are nil, the real os.Geteuid/os.Chown/os.Stat are used.
	MachineKeyPreparer MachineKeyPreparer
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

	return a.runBootstrap(ctx, layout, model, current)
}

// inspector returns the configured host inspector, defaulting to the real one.
func (a *App) inspector() system.Inspector {
	if a.Inspector != nil {
		return a.Inspector
	}
	return system.NewInspector(a.Runner)
}

// checkHost inspects the host and refuses to continue when it is not ready.
func (a *App) checkHost(ctx context.Context) error {
	report, err := a.inspector().Inspect(ctx)
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
		// Start from a blank, operator-supplied domain rather than the
		// maintainer's own "loegien.de" preset: that preset is only meant
		// as a convenience an operator can deliberately pick from the list,
		// not the value every fresh install is pre-filled with.
		onboarding.ApplyPreset(&on, onboarding.PresetCustom)
		tlsCfg.Strategy = tls.StrategyHetznerDNS
		err = a.Wizard.Run(&on, &tlsCfg)
		if err == nil {
			// A preset may have changed which scheme applies.
			if preset, ok := onboarding.Lookup(on.Preset); ok {
				preset.Apply(&on)
			}
			// Secure is derived from the TLS strategy exactly the way
			// HeadlessConfig derives it, never from whichever domain preset
			// was applied last, so the wizard and the headless path always
			// render the same scheme. Every strategy, internal included, is
			// HTTPS (see secureFor).
			on.Secure = secureFor(tlsCfg.Strategy)
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

	target := layout
	if a.Options.DryRun {
		// A dry run must never touch an existing installation.
		tmp, err := os.MkdirTemp("", "alfheim-dry-run-*")
		if err != nil {
			return templating.Model{}, layout, fmt.Errorf("alfheim-setup: create dry-run directory: %w", err)
		}
		target = paths.Layout{Root: tmp}
	}

	model := templating.Model{
		Onboarding: on,
		TLS:        tlsCfg,
		Secrets:    secrets,
		Version:    orUnknown(a.Build.Version),
		Generated:  a.now(),
	}

	if err := renderer.WriteAll(target, model); err != nil {
		return model, target, err
	}

	// The internal strategy's Caddyfile signs with a root CA that must exist
	// before Caddy starts. It is created once and reused on every later run
	// (including --reconfigure), so an imported root stays trusted.
	if tlsCfg.Strategy == tls.StrategyInternal {
		ca, err := tls.EnsureLocalCA(target, on.BaseDomain, a.now())
		if err != nil {
			return model, target, err
		}
		model.TLS.LocalCA = &ca
		verb := "Reusing"
		if ca.Created {
			verb = "Generated"
		}
		fmt.Fprintf(a.Stdout, "%s local root CA %s (SHA-256 %s)\n", verb, ca.CertFile, ca.Fingerprint)
	}

	// env.tmpl always renders the Zitadel-provisioned keys as an empty value
	// or the __PROVISIONED__ placeholder, since provisioning runs after
	// rendering. Carry forward whatever an earlier run actually provisioned
	// (the same way security.GenerateAll carries forward secrets above), or
	// --reconfigure would silently discard a working Grafana secret and the
	// bootstrap PAT and force a full re-provision on the next boot.
	if provisioned := carryForwardProvisioned(existing); len(provisioned) > 0 {
		if err := envfile.Update(target.EnvFile(), provisioned); err != nil {
			return model, target, fmt.Errorf(
				"alfheim-setup: carry forward provisioned Zitadel credentials: %w", err)
		}
	}

	fmt.Fprintf(a.Stdout, "Wrote %s\nWrote %s\n", target.EnvFile(), target.Caddyfile())
	return model, target, nil
}

// provisionedEnvKeys are the values internal/features/provisioning writes
// into .env (plus the bootstrap PAT, which readPAT persists there too).
// env.tmpl renders each as empty or as the __PROVISIONED__ placeholder,
// since provisioning always runs after rendering.
var provisionedEnvKeys = []string{
	"ZITADEL_BOOTSTRAP_PAT",
	"ZITADEL_PROJECT_ID",
	"OIDC_AUDIENCE",
	"ALFHEIM_WEB_CLIENT_ID",
	"GRAFANA_OIDC_CLIENT_ID",
	"GRAFANA_OIDC_CLIENT_SECRET",
}

// carryForwardProvisioned picks out the previously provisioned values worth
// restoring after a re-render. A value equal to the template's own
// placeholder is not a real previous value (for example a dry run rendered
// into a fresh directory) and is skipped, or it would just overwrite the
// freshly rendered placeholder with itself.
func carryForwardProvisioned(existing map[string]string) map[string]string {
	out := map[string]string{}
	for _, key := range provisionedEnvKeys {
		v := existing[key]
		if v == "" || v == "__PROVISIONED__" {
			continue
		}
		out[key] = v
	}
	return out
}

// runBootstrap performs the staged container boot for a fresh install,
// provisioning Zitadel's project and OIDC applications between the Edge &
// Identity phase and the Core & Application Stack phase so every consumer
// picks up the freshly generated client ids and secrets when the second
// phase starts them.
func (a *App) runBootstrap(
	ctx context.Context, layout paths.Layout, model templating.Model, current mode.Mode,
) error {
	if err := a.machineKeyPreparer().Prepare(layout); err != nil {
		return err
	}

	orch := bootstrap.New(a.Runner, layout, bootstrap.WithLogger(a.Stdout))

	if err := orch.RunPhase(ctx, bootstrap.PhaseEdgeAuth); err != nil {
		return err
	}

	// On a reconfigure Caddy may already be running with the previous
	// Caddyfile (for example plain HTTP before the internal strategy became
	// HTTPS), and `up -d` does not reload a bind-mounted file. Provisioning
	// below reaches Zitadel through Caddy with the new scheme, so the new
	// configuration must be live first.
	if current == mode.ModeReconfigure {
		if err := orch.RestartIngress(ctx); err != nil {
			return err
		}
		// An existing data volume never re-runs the Postgres init script,
		// so a database added since the first install must be created here.
		if err := orch.EnsureDatabases(ctx); err != nil {
			return err
		}
	}

	if err := a.provision(ctx, layout, model.Onboarding); err != nil {
		return err
	}

	if err := orch.RunPhase(ctx, bootstrap.PhaseCoreStack); err != nil {
		return err
	}
	if err := markInstalled(layout, a.Build.Version); err != nil {
		return err
	}

	a.printSummary(model)
	return nil
}

// provision reconciles the Zitadel project and OIDC applications and writes
// the results back into .env, from where docker compose's automatic .env
// loading feeds them to every consumer started in the next phase.
func (a *App) provision(ctx context.Context, layout paths.Layout, on onboarding.Config) error {
	fmt.Fprintln(a.Stdout, "Provisioning Zitadel OIDC clients …")

	existing, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		return fmt.Errorf("alfheim-setup: read .env before provisioning: %w", err)
	}

	result, err := a.provisioner().Provision(ctx, layout, on, existing)
	if err != nil {
		return fmt.Errorf("alfheim-setup: provision Zitadel: %w", err)
	}

	if err := envfile.Update(layout.EnvFile(), map[string]string{
		"ZITADEL_PROJECT_ID":         result.ProjectID,
		"OIDC_AUDIENCE":              result.ProjectID,
		"ALFHEIM_WEB_CLIENT_ID":      result.WebClientID,
		"GRAFANA_OIDC_CLIENT_ID":     result.GrafanaClientID,
		"GRAFANA_OIDC_CLIENT_SECRET": result.GrafanaSecret,
	}); err != nil {
		return fmt.Errorf("alfheim-setup: write provisioned credentials to .env: %w", err)
	}
	fmt.Fprintln(a.Stdout, "Zitadel OIDC clients are provisioned.")
	return nil
}

// provisioner returns the configured Provisioner, defaulting to the real one.
func (a *App) provisioner() Provisioner {
	if a.Provisioner != nil {
		return a.Provisioner
	}
	return &DefaultProvisioner{}
}

// machineKeyPreparer returns the configured MachineKeyPreparer, defaulting
// to the real os.Geteuid/os.Chown/os.Stat.
func (a *App) machineKeyPreparer() MachineKeyPreparer {
	if a.MachineKeyPreparer.Geteuid != nil {
		return a.MachineKeyPreparer
	}
	return newMachineKeyPreparer()
}

// runUpdate performs the Day-2 path: reconcile Zitadel, pull new images and
// restart. Provisioning runs again so a re-run reconciles any drift (for
// example a secret rotated by hand in the Zitadel console).
func (a *App) runUpdate(ctx context.Context, layout paths.Layout) error {
	fmt.Fprintln(a.Stdout, "An existing installation was detected.")
	fmt.Fprintln(a.Stdout, "Updating images and restarting services. "+
		"Re-run with --reconfigure to change the configuration.")

	if a.Options.DryRun {
		fmt.Fprintln(a.Stdout, "Dry run: no container was started.")
		return nil
	}

	existing, err := envfile.ParseFile(layout.EnvFile())
	if err != nil {
		return fmt.Errorf("alfheim-setup: read .env: %w", err)
	}
	on, err := onboarding.HeadlessConfigFromEnv(existing)
	if err != nil {
		return err
	}
	warnPlainHTTPInstall(a.Stderr, existing)
	if err := a.backfillSecrets(layout, existing); err != nil {
		return err
	}
	if err := a.provision(ctx, layout, on); err != nil {
		return err
	}

	orch := bootstrap.New(a.Runner, layout, bootstrap.WithLogger(a.Stdout))
	if err := orch.EnsureDatabases(ctx); err != nil {
		return err
	}
	return orch.RunPhase(ctx, bootstrap.PhaseCoreStack)
}

// backfillSecrets appends a generated value for every manifest secret the
// existing .env lacks (or holds empty) and leaves every present value
// untouched. A plain update never re-renders .env, so without this a release
// that introduces a new required secret (HOUSEHOLD_POSTGRES_PASSWORD,
// ALFHEIM_INTERNAL_TOKEN) would make docker compose refuse to start the stack
// until the operator ran --reconfigure.
func (a *App) backfillSecrets(layout paths.Layout, existing map[string]string) error {
	all, err := security.GenerateAll(security.NewGenerator(), existing)
	if err != nil {
		return err
	}
	missing := map[string]string{}
	for key, value := range all {
		if existing[key] == "" {
			missing[key] = value
		}
	}
	if len(missing) == 0 {
		return nil
	}
	if err := envfile.Update(layout.EnvFile(), missing); err != nil {
		return fmt.Errorf("alfheim-setup: add new secrets to .env: %w", err)
	}
	keys := make([]string, 0, len(missing))
	for key := range missing {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	fmt.Fprintf(a.Stdout, "Generated %d new secret(s) in .env: %s\n", len(keys), strings.Join(keys, ", "))
	return nil
}

// warnPlainHTTPInstall flags an installation rendered before every strategy
// served HTTPS. A plain update reuses the configuration on disk as is, so it
// cannot fix that on its own; --reconfigure regenerates .env and the
// Caddyfile, creates the local root CA and re-provisions Zitadel's redirect
// URIs as https.
func warnPlainHTTPInstall(w io.Writer, env map[string]string) {
	if env["ZITADEL_EXTERNALSECURE"] == "true" {
		return
	}
	fmt.Fprintf(w, "Warning: this installation is served over plain HTTP (ZITADEL_EXTERNALSECURE=%s). "+
		"Browsers block the PKCE login outside HTTPS, so sign-in to the dashboard and apps fails.\n"+
		"  Migrate once with: alfheim-setup --reconfigure\n"+
		"  (with --non-interactive, pass --domain, --admin-email and --tls %s again). "+
		"Existing secrets and OIDC clients are kept.\n",
		orDefault(env["ZITADEL_EXTERNALSECURE"], "unset"), orDefault(env["ALFHEIM_TLS_STRATEGY"], "internal"))
}

func orDefault(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

// printSummary reports how to reach the finished installation. It names the
// login name explicitly (the administrator e-mail the operator entered)
// because that is not guessable from the auth domain, and states that no
// self-registration is needed, since an unconfigured mail setup could never
// complete the verification round-trip a self-registered account would wait
// on.
func (a *App) printSummary(m templating.Model) {
	fmt.Fprintf(a.Stdout, `
Alfheim is up.

  Dashboard       %s
  Identity        %s
  Observability   %s/grafana/

  Credentials are stored in .env (mode 0600).

  Administrator login
    E-mail (login name):  %s
    Password:              %s (also in .env, ZITADEL_ADMIN_PASSWORD)
    A password change is required on first login.
    No self-registration is needed: sign in at %s with the credentials above.
`,
		m.Onboarding.BaseURL, m.Onboarding.IssuerURL, m.Onboarding.BaseURL,
		m.Onboarding.AdminEmail, m.Secret("ZITADEL_ADMIN_PASSWORD"), m.Onboarding.IssuerURL)

	if ca := m.TLS.LocalCA; ca != nil {
		a.printLocalCA(m.Onboarding, *ca)
	}
}

// printLocalCA tells the operator how to trust the internal strategy's
// self-generated root. Importing the root is the recommended path: browsers
// keep certificate exceptions per host, so accepting the warning only for the
// app host leaves the login's background OIDC discovery fetch to the auth
// host silently rejected ("Failed to fetch").
func (a *App) printLocalCA(on onboarding.Config, ca tls.LocalCA) {
	appURL := "https://" + on.AppHost
	authURL := "https://" + on.AuthHost
	fmt.Fprintf(a.Stdout, `
  HTTPS certificate (locally generated root CA)
    Root certificate:  %s
    SHA-256:           %s

    Recommended: import that file into your OS or browser trust store once;
    it covers every Alfheim host. Compare the SHA-256 fingerprint first.
      macOS:          Keychain Access > System keychain > import, then set
                      Trust to "Always Trust"
      Windows:        certmgr.msc > Trusted Root Certification Authorities >
                      Certificates > All Tasks > Import
      Linux/Firefox:  the browser's certificate settings > Authorities > Import
                      (Firefox keeps its own store)

    Fallback without importing: before signing in, open BOTH of these and
    accept the certificate warning on each, or login fails with
    "Failed to fetch":
      %s
      %s
`,
		ca.TrustFile, ca.Fingerprint, appURL, authURL)
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
