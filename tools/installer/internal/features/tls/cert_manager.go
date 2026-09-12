package tls

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"alfheim/installer/internal/shared/paths"
)

// pemPrefix is the first token of any PEM encoded file. Checking it catches
// the two mistakes operators actually make: pointing at a directory, and
// supplying a DER encoded certificate.
const pemPrefix = "-----BEGIN"

// statFS is the filesystem surface the manager needs. Injecting it keeps the
// validation rules testable with an in-memory filesystem.
type statFS interface {
	Stat(name string) (fs.FileInfo, error)
	Open(name string) (fs.File, error)
}

// osFS is the production statFS backed by the real filesystem.
type osFS struct{}

func (osFS) Stat(name string) (fs.FileInfo, error) { return os.Stat(name) }
func (osFS) Open(name string) (fs.File, error)     { return os.Open(name) }

// Manager resolves and validates certificate material.
type Manager struct {
	fs     statFS
	layout paths.Layout
}

// NewManager returns a Manager operating on the real filesystem.
func NewManager(layout paths.Layout) *Manager {
	return &Manager{fs: osFS{}, layout: layout}
}

// newManagerWithFS returns a Manager reading through a custom filesystem.
func newManagerWithFS(layout paths.Layout, fsys statFS) *Manager {
	return &Manager{fs: fsys, layout: layout}
}

// Resolve fills in every derived field of the configuration. For the default
// certificate mode it also creates the certificate directory.
func (m *Manager) Resolve(c *Config) error {
	if !c.Strategy.Known() {
		return fmt.Errorf("tls: unknown strategy %q", c.Strategy)
	}
	if c.Strategy != StrategyCustomCerts {
		return nil
	}

	if c.CertSource.Mode == "" {
		c.CertSource.Mode = CertModeDefault
	}

	switch c.CertSource.Mode {
	case CertModeDefault:
		c.CertSource.HostPath = m.layout.DefaultCertDir()
		// Private keys live here, so the directory is owner-only.
		if err := os.MkdirAll(c.CertSource.HostPath, 0o700); err != nil {
			return fmt.Errorf("tls: create certificate directory: %w", err)
		}
		// A relative bind mount keeps the install directory portable.
		c.CertSource.MountSpec = "./data/caddy/certs:" + containerCertDir + ":ro"

	case CertModeHostPath:
		host := strings.TrimSpace(c.CertSource.HostPath)
		if host == "" {
			return fmt.Errorf("tls: a custom certificate path is required")
		}
		// A relative path silently resolves against the Docker daemon's
		// working directory and breaks the bind mount, so reject it here.
		if !filepath.IsAbs(host) {
			return fmt.Errorf("tls: certificate path %q must be absolute", host)
		}
		c.CertSource.HostPath = filepath.Clean(host)
		c.CertSource.MountSpec = c.CertSource.HostPath + ":" + containerCertDir + ":ro"

	default:
		return fmt.Errorf("tls: unknown certificate mode %q", c.CertSource.Mode)
	}

	c.CertSource.ChainFile = filepath.Join(c.CertSource.HostPath, ChainFileName)
	c.CertSource.KeyFile = filepath.Join(c.CertSource.HostPath, KeyFileName)
	return nil
}

// Validate checks that everything the chosen strategy needs is present.
// Non-fatal findings are appended to c.Warnings rather than failing the run.
func (m *Manager) Validate(c *Config) error {
	if !c.Strategy.Known() {
		return fmt.Errorf("tls: unknown strategy %q", c.Strategy)
	}

	switch c.Strategy {
	case StrategyHetznerDNS, StrategyCloudflareDNS:
		if strings.TrimSpace(c.APIToken) == "" {
			return fmt.Errorf("tls: the %s strategy requires an API token", c.Strategy)
		}
		if c.ACMEEmail == "" {
			c.Warnings = append(c.Warnings,
				"No ACME contact e-mail was supplied; certificate expiry notices will not be delivered.")
		}

	case StrategyCustomCerts:
		if err := m.validateCertFile(c, c.CertSource.ChainFile, "certificate chain"); err != nil {
			return err
		}
		if err := m.validateCertFile(c, c.CertSource.KeyFile, "private key"); err != nil {
			return err
		}
		m.warnOnKeyPermissions(c)

	case StrategyInternal:
		c.Warnings = append(c.Warnings,
			"Caddy's internal CA is not trusted by browsers; expect a warning until you install its root certificate.")
	}
	return nil
}

// validateCertFile checks that a certificate file exists and looks like PEM.
func (m *Manager) validateCertFile(c *Config, path, label string) error {
	if path == "" {
		return fmt.Errorf("tls: %s path is empty; resolve the configuration first", label)
	}

	info, err := m.fs.Stat(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("tls: %s not found at %s (expected %s and %s in that directory)",
				label, path, ChainFileName, KeyFileName)
		}
		return fmt.Errorf("tls: inspect %s at %s: %w", label, path, err)
	}
	if info.IsDir() {
		return fmt.Errorf("tls: %s at %s is a directory, not a file", label, path)
	}
	if info.Size() == 0 {
		return fmt.Errorf("tls: %s at %s is empty", label, path)
	}

	return m.checkPEMHeader(path, label)
}

// checkPEMHeader rejects files that are not PEM encoded.
func (m *Manager) checkPEMHeader(path, label string) error {
	f, err := m.fs.Open(path)
	if err != nil {
		return fmt.Errorf("tls: read %s at %s: %w", label, path, err)
	}
	defer func() { _ = f.Close() }()

	header := make([]byte, len(pemPrefix))
	n, err := f.Read(header)
	if err != nil && n == 0 {
		return fmt.Errorf("tls: read %s at %s: %w", label, path, err)
	}
	if string(header[:n]) != pemPrefix {
		return fmt.Errorf("tls: %s at %s is not PEM encoded (it must start with %q)",
			label, path, pemPrefix)
	}
	return nil
}

// warnOnKeyPermissions reports a private key readable beyond its owner. This
// is a warning, not an error: some operators manage keys through a group.
func (m *Manager) warnOnKeyPermissions(c *Config) {
	info, err := m.fs.Stat(c.CertSource.KeyFile)
	if err != nil {
		return
	}
	if perm := info.Mode().Perm(); perm&0o077 != 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(
			"Private key %s is readable beyond its owner (mode %04o); consider chmod 600.",
			c.CertSource.KeyFile, perm))
	}
}
