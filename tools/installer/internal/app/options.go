// Package app wires the feature slices into the runnable installer. Keeping
// this logic out of main.go means every code path here is testable.
package app

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

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
}

// usage is printed for -h and on a usage error.
const usage = `alfheim-setup - interactive installer for Alfheim Sovereign OS

Usage:
  alfheim-setup [flags]

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
  --tls STRATEGY       ALFHEIM_TLS_STRATEGY   hetzner | cloudflare | custom | internal
  --api-token TOKEN    ALFHEIM_DNS_API_TOKEN  DNS provider token for the DNS-01 challenge
  --cert-path DIR      ALFHEIM_CERT_PATH      Absolute path holding fullchain.pem and privkey.pem
  --image-tag TAG      ALFHEIM_IMAGE_TAG      Container image tag (default: latest)

Exit codes:
  0 success   1 failure   2 usage error   130 interrupted
`

// ParseOptions parses args, falling back to the environment for headless
// answers. It never calls os.Exit, so the caller decides the exit code.
func ParseOptions(args []string, stderr io.Writer) (*Options, error) {
	opts := &Options{}

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

	if err := fs.Parse(args); err != nil {
		return nil, fmt.Errorf("alfheim-setup: %w", err)
	}
	if fs.NArg() > 0 {
		fmt.Fprint(stderr, usage)
		return nil, fmt.Errorf("alfheim-setup: unexpected argument %q", fs.Arg(0))
	}

	opts.applyEnvDefaults()

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
		{&o.InstallDir, "ALFHEIM_INSTALL_DIR"},
	}
	for _, f := range fallbacks {
		if *f.target == "" {
			*f.target = strings.TrimSpace(os.Getenv(f.env))
		}
	}

	if o.APIToken == "" {
		// Accept the provider-specific names too, since those are what the
		// Caddy modules themselves read.
		for _, key := range []string{
			"ALFHEIM_DNS_API_TOKEN", "HETZNER_API_TOKEN", "CLOUDFLARE_API_TOKEN",
		} {
			if v := strings.TrimSpace(os.Getenv(key)); v != "" {
				o.APIToken = v
				break
			}
		}
	}
}

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

	strategy, err := tls.ParseStrategy(o.TLSStrategy)
	if err != nil {
		return on, tlsCfg, err
	}

	on.Preset = onboarding.PresetCustom
	on.BaseDomain = o.Domain
	on.AppHost = o.AppHost
	on.AdminEmail = o.AdminEmail
	on.ImageTag = o.ImageTag
	// Only the internal CA is served over plain HTTP for a LAN install; every
	// other strategy produces a publicly trusted certificate.
	on.Secure = strategy != tls.StrategyInternal

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
