// Package paths resolves the on-disk layout of an Alfheim installation. It is
// the single source of truth for where the installer reads and writes files.
package paths

import (
	"fmt"
	"os"
	"path/filepath"
)

// Marker file written once a Day-1 install has completed successfully.
const MarkerName = ".alfheim.installed"

// Layout resolves installation paths relative to a single root directory.
type Layout struct {
	Root string
}

// New returns a Layout rooted at an absolute form of root.
func New(root string) (Layout, error) {
	if root == "" {
		return Layout{}, fmt.Errorf("paths: install root must not be empty")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return Layout{}, fmt.Errorf("paths: resolve %q: %w", root, err)
	}
	return Layout{Root: abs}, nil
}

// EnvFile is the generated production environment file.
func (l Layout) EnvFile() string { return filepath.Join(l.Root, ".env") }

// EnvExample is the template shipped with the repository.
func (l Layout) EnvExample() string { return filepath.Join(l.Root, ".env.example") }

// ComposeFile is the production Docker Compose definition.
func (l Layout) ComposeFile() string { return filepath.Join(l.Root, "compose.prod.yaml") }

// Caddyfile is the rendered ingress configuration.
func (l Layout) Caddyfile() string {
	return filepath.Join(l.Root, "infrastructure", "caddy", "Caddyfile")
}

// DefaultCertDir is the bundled location for operator-supplied certificates.
func (l Layout) DefaultCertDir() string {
	return filepath.Join(l.Root, "data", "caddy", "certs")
}

// Marker is the Day-1 completion marker.
func (l Layout) Marker() string { return filepath.Join(l.Root, MarkerName) }

// IsLocalRepo reports whether the root looks like a checked-out Alfheim repo
// rather than an empty standalone install directory.
func (l Layout) IsLocalRepo() bool {
	if _, err := os.Stat(l.ComposeFile()); err != nil {
		return false
	}
	_, err := os.Stat(filepath.Join(l.Root, "infrastructure"))
	return err == nil
}

// EnsureDirs creates the directory tree an installation needs.
func (l Layout) EnsureDirs() error {
	dirs := []struct {
		path string
		perm os.FileMode
	}{
		{filepath.Join(l.Root, "infrastructure", "caddy"), 0o755},
		{filepath.Join(l.Root, "infrastructure", "postgres"), 0o755},
		{filepath.Join(l.Root, "infrastructure", "telemetry", "collector"), 0o755},
		// Certificates may hold private keys, so the tree is owner-only.
		{l.DefaultCertDir(), 0o700},
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d.path, d.perm); err != nil {
			return fmt.Errorf("paths: create %s: %w", d.path, err)
		}
	}
	return nil
}
