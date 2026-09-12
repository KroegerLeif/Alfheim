package paths

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNew(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("New(\"\") error = nil, want a failure")
	}
	l, err := New(".")
	if err != nil {
		t.Fatalf("New(.) error = %v", err)
	}
	if !filepath.IsAbs(l.Root) {
		t.Fatalf("Root = %q, want an absolute path", l.Root)
	}
}

func TestLayoutPaths(t *testing.T) {
	l := Layout{Root: "/srv/alfheim"}
	tests := []struct {
		name string
		got  string
		want string
	}{
		{"env", l.EnvFile(), "/srv/alfheim/.env"},
		{"env example", l.EnvExample(), "/srv/alfheim/.env.example"},
		{"compose", l.ComposeFile(), "/srv/alfheim/compose.prod.yaml"},
		{"caddyfile", l.Caddyfile(), "/srv/alfheim/infrastructure/caddy/Caddyfile"},
		{"cert dir", l.DefaultCertDir(), "/srv/alfheim/data/caddy/certs"},
		{"marker", l.Marker(), "/srv/alfheim/" + MarkerName},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.got != filepath.FromSlash(tc.want) {
				t.Fatalf("got %q, want %q", tc.got, tc.want)
			}
		})
	}
}

func TestEnsureDirs(t *testing.T) {
	l := Layout{Root: t.TempDir()}
	if err := l.EnsureDirs(); err != nil {
		t.Fatalf("EnsureDirs() error = %v", err)
	}
	for _, dir := range []string{
		filepath.Join(l.Root, "infrastructure", "caddy"),
		filepath.Join(l.Root, "infrastructure", "postgres"),
		filepath.Join(l.Root, "infrastructure", "telemetry", "collector"),
		l.DefaultCertDir(),
	} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatalf("expected %s to exist: %v", dir, err)
		}
		if !info.IsDir() {
			t.Fatalf("%s is not a directory", dir)
		}
	}

	// The certificate directory may hold private keys and must be owner-only.
	info, err := os.Stat(l.DefaultCertDir())
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o700 {
		t.Fatalf("cert dir permissions = %o, want 700", perm)
	}

	// EnsureDirs is idempotent.
	if err := l.EnsureDirs(); err != nil {
		t.Fatalf("second EnsureDirs() error = %v", err)
	}
}

func TestEnsureDirsFailsOnFileCollision(t *testing.T) {
	root := t.TempDir()
	// A regular file where a directory belongs makes MkdirAll fail.
	if err := os.WriteFile(filepath.Join(root, "infrastructure"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	l := Layout{Root: root}
	err := l.EnsureDirs()
	if err == nil {
		t.Fatal("EnsureDirs() error = nil, want a failure")
	}
	if !strings.Contains(err.Error(), "paths: create") {
		t.Fatalf("error = %v, want it to name the failing path", err)
	}
}

func TestIsLocalRepo(t *testing.T) {
	root := t.TempDir()
	l := Layout{Root: root}
	if l.IsLocalRepo() {
		t.Fatal("IsLocalRepo() = true for an empty directory")
	}

	if err := os.WriteFile(l.ComposeFile(), []byte("services:"), 0o600); err != nil {
		t.Fatal(err)
	}
	if l.IsLocalRepo() {
		t.Fatal("IsLocalRepo() = true without an infrastructure directory")
	}

	if err := os.MkdirAll(filepath.Join(root, "infrastructure"), 0o755); err != nil {
		t.Fatal(err)
	}
	if !l.IsLocalRepo() {
		t.Fatal("IsLocalRepo() = false for a checked-out repository")
	}
}
