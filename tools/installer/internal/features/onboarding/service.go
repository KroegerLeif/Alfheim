package onboarding

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
)

// hostnamePattern matches an RFC 1123 hostname label sequence. It deliberately
// rejects a scheme, a port, a path and a trailing dot, because those all end
// up corrupting the Caddy site addresses and the OIDC issuer.
var hostnamePattern = regexp.MustCompile(
	`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)

// Derive fills every value that follows from the operator's answers. It is
// pure, so the wizard and the headless path produce identical results.
func Derive(c *Config) error {
	c.BaseDomain = normaliseHost(c.BaseDomain)
	c.AppHost = normaliseHost(c.AppHost)

	if c.BaseDomain == "" {
		return fmt.Errorf("onboarding: base domain is required")
	}
	// A custom install may leave the application host blank, in which case
	// the base domain itself serves the dashboard.
	if c.AppHost == "" {
		c.AppHost = c.BaseDomain
	}

	// Zitadel cannot be path-hosted, so it always gets its own subdomain.
	c.AuthHost = "auth." + c.BaseDomain

	scheme := "https"
	if !c.Secure {
		scheme = "http"
	}
	c.BaseURL = scheme + "://" + c.AppHost
	c.IssuerURL = scheme + "://" + c.AuthHost

	if c.Registry == "" {
		c.Registry = DefaultRegistry
	}
	if c.Repo == "" {
		c.Repo = DefaultRepo
	}
	if c.ImageTag == "" {
		c.ImageTag = DefaultImageTag
	}
	return nil
}

// Validate reports whether the configuration can produce a working install.
func Validate(c Config) error {
	if _, ok := Lookup(c.Preset); !ok {
		return fmt.Errorf("onboarding: unknown preset %q", c.Preset)
	}
	if err := validateHost("base domain", c.BaseDomain); err != nil {
		return err
	}
	if err := validateHost("application host", c.AppHost); err != nil {
		return err
	}
	if err := validateHost("auth host", c.AuthHost); err != nil {
		return err
	}
	if c.AdminEmail != "" {
		if _, err := mail.ParseAddress(c.AdminEmail); err != nil {
			return fmt.Errorf("onboarding: administrator e-mail %q is not valid: %w",
				c.AdminEmail, err)
		}
	}
	if c.ImageTag == "" {
		return fmt.Errorf("onboarding: image tag must not be empty")
	}
	return nil
}

// ImageReference renders the fully qualified image prefix for Compose.
func (c Config) ImageReference() string {
	return fmt.Sprintf("%s/%s", c.Registry, c.Repo)
}

// WildcardDomain is the certificate subject used for DNS-01 issuance.
func (c Config) WildcardDomain() string { return "*." + c.BaseDomain }

// validateHost rejects anything that is not a bare hostname.
func validateHost(label, host string) error {
	switch {
	case host == "":
		return fmt.Errorf("onboarding: %s is required", label)
	case strings.Contains(host, "://"):
		return fmt.Errorf("onboarding: %s %q must not include a scheme", label, host)
	case strings.Contains(host, "/"):
		return fmt.Errorf("onboarding: %s %q must not include a path", label, host)
	case strings.Contains(host, ":"):
		return fmt.Errorf("onboarding: %s %q must not include a port", label, host)
	case len(host) > 253:
		return fmt.Errorf("onboarding: %s %q exceeds 253 characters", label, host)
	case !hostnamePattern.MatchString(host):
		return fmt.Errorf("onboarding: %s %q is not a valid hostname", label, host)
	}
	return nil
}

// normaliseHost lowercases a hostname and strips the decorations operators
// habitually paste in: a scheme, a trailing slash and a trailing dot.
func normaliseHost(host string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	if idx := strings.Index(host, "://"); idx >= 0 {
		host = host[idx+3:]
	}
	host = strings.TrimSuffix(host, "/")
	host = strings.TrimSuffix(host, ".")
	return host
}

// Scheme returns the URL scheme the installation is served over.
func (c Config) Scheme() string {
	if c.Secure {
		return "https"
	}
	return "http"
}
