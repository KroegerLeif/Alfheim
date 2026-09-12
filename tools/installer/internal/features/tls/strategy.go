// Package tls models the certificate strategies the Caddy ingress can be
// configured with, and validates the operator-supplied material each needs.
package tls

import "fmt"

// Strategy selects how the ingress obtains its certificates.
type Strategy string

const (
	// StrategyHetznerDNS issues wildcard certificates over the ACME DNS-01
	// challenge using the Hetzner DNS API, so no inbound port 80 is needed.
	StrategyHetznerDNS Strategy = "hetzner"
	// StrategyCloudflareDNS is the same challenge against Cloudflare DNS.
	StrategyCloudflareDNS Strategy = "cloudflare"
	// StrategyCustomCerts mounts operator-supplied certificate files.
	StrategyCustomCerts Strategy = "custom"
	// StrategyInternal uses Caddy's internal CA, for LAN or offline use.
	StrategyInternal Strategy = "internal"
)

// CertMode selects where custom certificates are read from.
type CertMode string

const (
	// CertModeDefault reads from ./data/caddy/certs inside the install root.
	CertModeDefault CertMode = "default"
	// CertModeHostPath reads from an absolute path elsewhere on the host.
	CertModeHostPath CertMode = "hostpath"
)

// Canonical file names expected in a certificate directory.
const (
	ChainFileName = "fullchain.pem"
	KeyFileName   = "privkey.pem"
)

// containerCertDir is where the certificate directory is mounted inside Caddy.
const containerCertDir = "/etc/caddy/certs"

// CertSource describes resolved certificate material.
type CertSource struct {
	Mode CertMode
	// HostPath is the directory on the host holding the certificate files.
	HostPath string
	// ChainFile and KeyFile are absolute host paths to the resolved files.
	ChainFile string
	KeyFile   string
	// MountSpec is the Compose volume entry binding HostPath into Caddy.
	MountSpec string
}

// ContainerChainFile is the path Caddy sees for the certificate chain.
func (s CertSource) ContainerChainFile() string { return containerCertDir + "/" + ChainFileName }

// ContainerKeyFile is the path Caddy sees for the private key.
func (s CertSource) ContainerKeyFile() string { return containerCertDir + "/" + KeyFileName }

// Config holds the answers of the TLS step.
type Config struct {
	Strategy   Strategy
	APIToken   string
	ACMEEmail  string
	CertSource CertSource

	// Warnings collects non-fatal findings surfaced to the operator.
	Warnings []string
}

// Strategies is the ordered list offered in the TUI.
var Strategies = []struct {
	ID          Strategy
	Title       string
	Description string
}{
	{StrategyHetznerDNS, "Hetzner DNS-01 (wildcard)",
		"Automatic wildcard certificates via the Hetzner DNS API. No inbound port 80 required."},
	{StrategyCloudflareDNS, "Cloudflare DNS-01 (wildcard)",
		"Automatic wildcard certificates via the Cloudflare DNS API."},
	{StrategyCustomCerts, "Custom certificates",
		"Mount certificate files you already hold."},
	{StrategyInternal, "Caddy internal CA (self-signed)",
		"Self-signed certificates for LAN or offline operation."},
}

// UsesDNSChallenge reports whether the strategy solves ACME over DNS-01.
func (s Strategy) UsesDNSChallenge() bool {
	return s == StrategyHetznerDNS || s == StrategyCloudflareDNS
}

// DNSProvider returns the Caddy DNS module name backing the strategy.
func (s Strategy) DNSProvider() string {
	switch s {
	case StrategyHetznerDNS:
		return "hetzner"
	case StrategyCloudflareDNS:
		return "cloudflare"
	default:
		return ""
	}
}

// TokenEnvVar names the environment variable holding the DNS API token. The
// token is referenced from the Caddyfile as {env.NAME} and never written into
// it, so the rendered Caddyfile stays safe to commit.
func (s Strategy) TokenEnvVar() string {
	switch s {
	case StrategyHetznerDNS:
		return "HETZNER_API_TOKEN"
	case StrategyCloudflareDNS:
		return "CLOUDFLARE_API_TOKEN"
	default:
		return ""
	}
}

// Known reports whether the strategy is one this installer supports.
func (s Strategy) Known() bool {
	switch s {
	case StrategyHetznerDNS, StrategyCloudflareDNS, StrategyCustomCerts, StrategyInternal:
		return true
	default:
		return false
	}
}

// ParseStrategy converts CLI input into a Strategy.
func ParseStrategy(raw string) (Strategy, error) {
	s := Strategy(raw)
	if !s.Known() {
		return "", fmt.Errorf("tls: unknown strategy %q (want hetzner, cloudflare, custom or internal)", raw)
	}
	return s, nil
}

// String renders the strategy identifier, so templates can compare against a
// plain string literal.
func (s Strategy) String() string { return string(s) }
