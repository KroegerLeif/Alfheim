package tls

import (
	"errors"
	"strings"

	"github.com/charmbracelet/huh"
)

// NewForm builds the TLS step of the wizard, writing directly into c.
//
// Like the onboarding form this constructor holds no rules of its own: the
// certificate checks live in Manager so the headless path enforces them too.
func NewForm(c *Config) *huh.Form {
	strategyOptions := make([]huh.Option[Strategy], 0, len(Strategies))
	for _, s := range Strategies {
		strategyOptions = append(strategyOptions, huh.NewOption(s.Title, s.ID))
	}

	needsToken := func() bool { return !c.Strategy.UsesDNSChallenge() }
	needsCertPath := func() bool { return c.Strategy != StrategyCustomCerts }
	needsHostPath := func() bool {
		return c.Strategy != StrategyCustomCerts || c.CertSource.Mode != CertModeHostPath
	}

	return huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[Strategy]().
				Title("Certificate strategy").
				Description("How the ingress gateway obtains its TLS certificates.").
				Options(strategyOptions...).
				Value(&c.Strategy),
		),

		huh.NewGroup(
			huh.NewInput().
				Title("DNS API token").
				Description("Stored in .env and referenced from the Caddyfile, never written into it.").
				EchoMode(huh.EchoModePassword).
				Value(&c.APIToken).
				Validate(func(s string) error {
					if strings.TrimSpace(s) == "" {
						return errors.New("an API token is required for the DNS-01 challenge")
					}
					return nil
				}),
			huh.NewInput().
				Title("ACME contact e-mail").
				Description("Receives certificate expiry notices. Optional but recommended.").
				Placeholder("ops@example.com").
				Value(&c.ACMEEmail),
		).WithHideFunc(needsToken),

		huh.NewGroup(
			huh.NewSelect[CertMode]().
				Title("Certificate location").
				Options(
					huh.NewOption("Bundled directory (./data/caddy/certs)", CertModeDefault),
					huh.NewOption("Custom absolute host path", CertModeHostPath),
				).
				Value(&c.CertSource.Mode),
		).WithHideFunc(needsCertPath),

		huh.NewGroup(
			huh.NewInput().
				Title("Certificate directory").
				Description("Absolute path containing "+ChainFileName+" and "+KeyFileName+".").
				Placeholder("/etc/letsencrypt/live/example.com").
				Value(&c.CertSource.HostPath),
		).WithHideFunc(needsHostPath),
	)
}
