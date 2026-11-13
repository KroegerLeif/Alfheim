// Package app wires the feature slices into the runnable installer. Keeping
// this logic out of main.go means every code path here is testable.
package app

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"alfheim/installer/internal/features/apps"
	"alfheim/installer/internal/features/datapaths"
	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
)

// Exit codes the binary reports.
const (
	ExitOK        = 0
	ExitFailure   = 1
	ExitUsage     = 2
	ExitInterrupt = 130
)

// Options are the parsed command line and environment settings.
type Options struct {
	DryRun         bool
	NonInteractive bool
	Reconfigure    bool
	ShowVersion    bool
	InstallDir     string

	// Headless answers, also settable through the environment.
	Domain      string
	AppHost     string
	AdminEmail  string
	TLSStrategy string
	APIToken    string
	CertPath    string
	ImageTag    string

	// Apps is the optional app selection: "all", "none" or a comma-separated
	// list of app names (ALFHEIM_APPS). Empty keeps the stored set, or the
	// Lean Core on a fresh install.
	Apps string

	// DataPaths are host directories for persistent data, keyed by the .env
	// variable (ALFHEIM_DB_DATA_PATH, ...). Empty keeps the named volume.
	DataPaths datapaths.Paths
}

// usage is printed for -h and on a usage error.
const usage = `alfheim-setup - interactive installer for Alfheim Sovereign OS

Usage:
  alfheim-setup [flags]
  alfheim-setup update [--version vX.Y.Z] [--install-dir DIR] [--yes]
  alfheim-setup apps list|enable <name>|disable <name> [--install-dir DIR]

Run without arguments for a first install, or a plain re-run (Day-2: pulls
images and restarts with the configuration already on disk). Run
"alfheim-setup update" to fetch a specific release's stack files onto an
existing installation and restart on it — see "alfheim-setup update -h".

Flags:
  --dry-run            Validate, generate secrets and render configuration into a
                       temporary directory without starting any container.
  --non-interactive    Take every answer from flags and environment variables.
  --reconfigure        Re-run the configuration wizard over an existing install.
                       Existing secrets are preserved, never rotated.
  --install-dir DIR    Installation root (default: the current directory).
  --version            Print build metadata and exit.

Headless answers (each also readable from the environment):
  --domain HOST        ALFHEIM_DOMAIN         Base domain, e.g. example.com
  --app-host HOST      ALFHEIM_APP_HOST       Dashboard host (default: the base domain)
  --admin-email MAIL   ALFHEIM_ADMIN_EMAIL    ACME and administrator contact
  --tls STRATEGY       ALFHEIM_TLS_STRATEGY   hetzner | cloudflare | desec | custom | internal
  --api-token TOKEN    ALFHEIM_DNS_API_TOKEN  DNS provider token for the DNS-01 challenge
  --cert-path DIR      ALFHEIM_CERT_PATH      Absolute path holding fullchain.pem and privkey.pem
  --image-tag TAG      ALFHEIM_IMAGE_TAG      Container image tag (default: latest)

App selection (default on a fresh install: the Lean Core, dashboard and
household only; a re-run keeps the stored set):
  --apps LIST          ALFHEIM_APPS           all | none | comma-separated apps,
                       e.g. pantry,shopping,telemetry. Change it later with
                       "alfheim-setup apps enable|disable".

Data locations (optional; absolute host paths, default: Docker named volumes).
The installer creates each directory with the owner its container needs and
fails if it is not writable. An earlier choice in .env is kept on a re-run.
  --db-data-path DIR       ALFHEIM_DB_DATA_PATH       PostgreSQL data (owner 70)
  --object-data-path DIR   ALFHEIM_OBJECT_DATA_PATH   RustFS object storage (owner 10001)
  --metrics-data-path DIR  ALFHEIM_METRICS_DATA_PATH  VictoriaMetrics data
  --logs-data-path DIR     ALFHEIM_LOGS_DATA_PATH     VictoriaLogs data

Exit codes:
  0 success   1 failure   2 usage error   130 interrupted
`

// ParseOptions parses args, falling back to the environment for headless
// answers. It never calls os.Exit, so the caller decides the exit code.
func ParseOptions(args []string, stderr io.Writer) (*Options, error) {
	opts := &Options{DataPaths: datapaths.Paths{}}

	fs := flag.NewFlagSet("alfheim-setup", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, usage) }

	fs.BoolVar(&opts.DryRun, "dry-run", false, "render configuration without starting containers")
	fs.BoolVar(&opts.NonInteractive, "non-interactive", false, "take every answer from flags and the environment")
	fs.BoolVar(&opts.Reconfigure, "reconfigure", false, "re-run the wizard over an existing installation")
	fs.BoolVar(&opts.ShowVersion, "version", false, "print build metadata and exit")
	fs.StringVar(&opts.InstallDir, "install-dir", "", "installation root")

	fs.StringVar(&opts.Domain, "domain", "", "base domain")
	fs.StringVar(&opts.AppHost, "app-host", "", "dashboard host")
	fs.StringVar(&opts.AdminEmail, "admin-email", "", "administrator e-mail")
	fs.StringVar(&opts.TLSStrategy, "tls", "", "TLS strategy")
	fs.StringVar(&opts.APIToken, "api-token", "", "DNS provider API token")
	fs.StringVar(&opts.CertPath, "cert-path", "", "certificate directory")
	fs.StringVar(&opts.ImageTag, "image-tag", "", "container image tag")
	fs.StringVar(&opts.Apps, "apps", "", "optional apps: all, none or a comma-separated list")

	dataFlags := make(map[string]*string, len(datapaths.Classes))
	for _, c := range datapaths.Classes {
		dataFlags[c.Key] = fs.String(c.Flag, "", c.Title+" directory (absolute path)")
	}

	if err := fs.Parse(args); err != nil {
		return nil, fmt.Errorf("alfheim-setup: %w", err)
	}
	if fs.NArg() > 0 {
		fmt.Fprint(stderr, usage)
		return nil, fmt.Errorf("alfheim-setup: unexpected argument %q", fs.Arg(0))
	}

	for _, c := range datapaths.Classes {
		if v := strings.TrimSpace(*dataFlags[c.Key]); v != "" {
			opts.DataPaths[c.Key] = v
		}
	}
	opts.applyEnvDefaults()
	if opts.Apps != "" {
		if _, err := apps.ParseSelection(opts.Apps); err != nil {
			return nil, fmt.Errorf("alfheim-setup: --apps: %w", err)
		}
	}

	if opts.InstallDir == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("alfheim-setup: resolve working directory: %w", err)
		}
		opts.InstallDir = cwd
	}
	return opts, nil
}

// applyEnvDefaults fills unset flags from the environment, so the headless
// path works in a CI pipeline without a long command line.
func (o *Options) applyEnvDefaults() {
	fallbacks := []struct {
		target *string
		env    string
	}{
		{&o.Domain, "ALFHEIM_DOMAIN"},
		{&o.AppHost, "ALFHEIM_APP_HOST"},
		{&o.AdminEmail, "ALFHEIM_ADMIN_EMAIL"},
		{&o.TLSStrategy, "ALFHEIM_TLS_STRATEGY"},
		{&o.CertPath, "ALFHEIM_CERT_PATH"},
		{&o.ImageTag, "ALFHEIM_IMAGE_TAG"},
		{&o.Apps, "ALFHEIM_APPS"},
		{&o.InstallDir, "ALFHEIM_INSTALL_DIR"},
	}
	for _, f := range fallbacks {
		if *f.target == "" {
			*f.target = strings.TrimSpace(os.Getenv(f.env))
		}
	}

	for _, c := range datapaths.Classes {
		if o.DataPaths[c.Key] == "" {
			if v := strings.TrimSpace(os.Getenv(c.Key)); v != "" {
				o.DataPaths[c.Key] = v
			}
		}
	}

	if o.APIToken == "" {
		// Accept the provider-specific names too, since those are what the
		// Caddy modules themselves read.
		for _, key := range []string{
			"ALFHEIM_DNS_API_TOKEN", "HETZNER_API_TOKEN", "CLOUDFLARE_API_TOKEN",
			"DESEC_TOKEN",
		} {
			if v := strings.TrimSpace(os.Getenv(key)); v != "" {
				o.APIToken = v
				break
			}
		}
	}
}

// secureFor reports whether an installation using strategy is served over
// HTTPS. It is the single derivation both the wizard and the headless path
// use, so the two can never disagree.
//
// Every strategy is HTTPS, the internal one included: browsers disable
// crypto.subtle outside a secure context, so the PKCE login every frontend
// performs cannot work over plain HTTP on a real hostname. The internal
// strategy signs with a root CA the installer generates instead, which
// browsers warn about until it is imported or accepted.
func secureFor(tls.Strategy) bool { return true }

// HeadlessConfig converts the headless answers into feature configuration.
// It reports precisely which input is missing, so a CI failure is actionable.
func (o *Options) HeadlessConfig() (onboarding.Config, tls.Config, error) {
	var on onboarding.Config
	var tlsCfg tls.Config

	if o.Domain == "" {
		return on, tlsCfg, fmt.Errorf(
			"alfheim-setup: --domain (or ALFHEIM_DOMAIN) is required in non-interactive mode")
	}
	if o.TLSStrategy == "" {
		return on, tlsCfg, fmt.Errorf(
			"alfheim-setup: --tls (or ALFHEIM_TLS_STRATEGY) is required in non-interactive mode")
	}
	if o.AdminEmail == "" {
		return on, tlsCfg, fmt.Errorf(
			"alfheim-setup: --admin-email (or ALFHEIM_ADMIN_EMAIL) is required in non-interactive mode")
	}

	strategy, err := tls.ParseStrategy(o.TLSStrategy)
	if err != nil {
		return on, tlsCfg, err
	}

	on.Preset = onboarding.PresetCustom
	on.BaseDomain = o.Domain
	on.AppHost = o.AppHost
	on.AdminEmail = o.AdminEmail
	on.ImageTag = o.ImageTag
	on.Secure = secureFor(strategy)

	tlsCfg.Strategy = strategy
	tlsCfg.APIToken = o.APIToken
	tlsCfg.ACMEEmail = o.AdminEmail

	if strategy.UsesDNSChallenge() && o.APIToken == "" {
		return on, tlsCfg, fmt.Errorf(
			"alfheim-setup: --api-token (or ALFHEIM_DNS_API_TOKEN) is required for the %s strategy",
			strategy)
	}
	if strategy == tls.StrategyCustomCerts && o.CertPath != "" {
		tlsCfg.CertSource.Mode = tls.CertModeHostPath
		tlsCfg.CertSource.HostPath = o.CertPath
	}

	return on, tlsCfg, nil
}
