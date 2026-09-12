package tls

import (
	"io/fs"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"alfheim/installer/internal/shared/paths"
)

const validPEM = "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----\n"

// fakeFS adapts fstest.MapFS to the absolute paths the manager works with.
type fakeFS struct{ m fstest.MapFS }

// trim converts an absolute path into the relative key MapFS expects.
func trim(name string) string { return strings.TrimPrefix(name, "/") }

func (f fakeFS) Stat(name string) (fs.FileInfo, error) { return f.m.Stat(trim(name)) }
func (f fakeFS) Open(name string) (fs.File, error)     { return f.m.Open(trim(name)) }

func certFS(files map[string]*fstest.MapFile) fakeFS {
	return fakeFS{m: fstest.MapFS(files)}
}

func customConfig(hostPath string) *Config {
	return &Config{
		Strategy: StrategyCustomCerts,
		CertSource: CertSource{
			Mode:      CertModeHostPath,
			HostPath:  hostPath,
			ChainFile: hostPath + "/" + ChainFileName,
			KeyFile:   hostPath + "/" + KeyFileName,
		},
	}
}

func TestResolveDefaultModeUsesBundledDirectory(t *testing.T) {
	layout := paths.Layout{Root: t.TempDir()}
	m := NewManager(layout)

	c := &Config{Strategy: StrategyCustomCerts}
	if err := m.Resolve(c); err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}

	if c.CertSource.Mode != CertModeDefault {
		t.Fatalf("Mode = %q, want the default mode", c.CertSource.Mode)
	}
	if c.CertSource.HostPath != layout.DefaultCertDir() {
		t.Fatalf("HostPath = %q, want %q", c.CertSource.HostPath, layout.DefaultCertDir())
	}
	if c.CertSource.MountSpec != "./data/caddy/certs:/etc/caddy/certs:ro" {
		t.Fatalf("MountSpec = %q", c.CertSource.MountSpec)
	}
	if !strings.HasSuffix(c.CertSource.ChainFile, ChainFileName) {
		t.Fatalf("ChainFile = %q", c.CertSource.ChainFile)
	}

	// The directory must exist and be owner-only.
	info, err := osFS{}.Stat(c.CertSource.HostPath)
	if err != nil {
		t.Fatalf("certificate directory was not created: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o700 {
		t.Fatalf("permissions = %04o, want 0700", perm)
	}
}

func TestResolveHostPathMode(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})
	c := &Config{
		Strategy:   StrategyCustomCerts,
		CertSource: CertSource{Mode: CertModeHostPath, HostPath: "/etc/letsencrypt/live/example.com/"},
	}
	if err := m.Resolve(c); err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}
	if c.CertSource.HostPath != "/etc/letsencrypt/live/example.com" {
		t.Fatalf("HostPath = %q, want it cleaned", c.CertSource.HostPath)
	}
	want := "/etc/letsencrypt/live/example.com:/etc/caddy/certs:ro"
	if c.CertSource.MountSpec != want {
		t.Fatalf("MountSpec = %q, want %q", c.CertSource.MountSpec, want)
	}
}

func TestResolveRejectsRelativeHostPath(t *testing.T) {
	// A relative path resolves against the Docker daemon's working directory
	// and silently produces an empty mount.
	m := NewManager(paths.Layout{Root: t.TempDir()})
	c := &Config{
		Strategy:   StrategyCustomCerts,
		CertSource: CertSource{Mode: CertModeHostPath, HostPath: "certs/live"},
	}
	err := m.Resolve(c)
	if err == nil || !strings.Contains(err.Error(), "must be absolute") {
		t.Fatalf("Resolve() error = %v, want an absolute-path failure", err)
	}
}

func TestResolveErrors(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})
	tests := []struct {
		name    string
		cfg     *Config
		wantErr string
	}{
		{"unknown strategy", &Config{Strategy: Strategy("nope")}, "unknown strategy"},
		{"empty host path", &Config{
			Strategy:   StrategyCustomCerts,
			CertSource: CertSource{Mode: CertModeHostPath, HostPath: "   "},
		}, "certificate path is required"},
		{"unknown cert mode", &Config{
			Strategy:   StrategyCustomCerts,
			CertSource: CertSource{Mode: CertMode("weird")},
		}, "unknown certificate mode"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := m.Resolve(tc.cfg)
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("Resolve() error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

func TestResolveIsANoOpForNonCustomStrategies(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})
	for _, s := range []Strategy{StrategyHetznerDNS, StrategyCloudflareDNS, StrategyInternal} {
		c := &Config{Strategy: s}
		if err := m.Resolve(c); err != nil {
			t.Fatalf("Resolve(%s) error = %v", s, err)
		}
		if c.CertSource.MountSpec != "" {
			t.Fatalf("strategy %s must not produce a mount", s)
		}
	}
}

func TestValidateDNSStrategies(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})

	for _, s := range []Strategy{StrategyHetznerDNS, StrategyCloudflareDNS} {
		t.Run(string(s)+" without token", func(t *testing.T) {
			c := &Config{Strategy: s, APIToken: "  "}
			err := m.Validate(c)
			if err == nil || !strings.Contains(err.Error(), "requires an API token") {
				t.Fatalf("Validate() error = %v", err)
			}
		})

		t.Run(string(s)+" with token", func(t *testing.T) {
			c := &Config{Strategy: s, APIToken: "secret-token"}
			if err := m.Validate(c); err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
			if len(c.Warnings) != 1 || !strings.Contains(c.Warnings[0], "ACME contact") {
				t.Fatalf("Warnings = %v, want a missing-e-mail notice", c.Warnings)
			}
		})

		t.Run(string(s)+" with token and e-mail", func(t *testing.T) {
			c := &Config{Strategy: s, APIToken: "secret-token", ACMEEmail: "ops@example.com"}
			if err := m.Validate(c); err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
			if len(c.Warnings) != 0 {
				t.Fatalf("Warnings = %v, want none", c.Warnings)
			}
		})
	}
}

func TestValidateInternalWarnsAboutTrust(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})
	c := &Config{Strategy: StrategyInternal}
	if err := m.Validate(c); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if len(c.Warnings) != 1 || !strings.Contains(c.Warnings[0], "not trusted by browsers") {
		t.Fatalf("Warnings = %v", c.Warnings)
	}
}

func TestValidateCustomCertsHappyPath(t *testing.T) {
	fsys := certFS(map[string]*fstest.MapFile{
		"certs/fullchain.pem": {Data: []byte(validPEM), Mode: 0o644},
		"certs/privkey.pem":   {Data: []byte(validPEM), Mode: 0o600},
	})
	m := newManagerWithFS(paths.Layout{Root: "/srv"}, fsys)

	c := customConfig("/certs")
	if err := m.Validate(c); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if len(c.Warnings) != 0 {
		t.Fatalf("Warnings = %v, want none", c.Warnings)
	}
}

func TestValidateCustomCertsFailures(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]*fstest.MapFile
		wantErr string
	}{
		{
			"chain missing",
			map[string]*fstest.MapFile{"certs/privkey.pem": {Data: []byte(validPEM), Mode: 0o600}},
			"certificate chain not found",
		},
		{
			"key missing",
			map[string]*fstest.MapFile{"certs/fullchain.pem": {Data: []byte(validPEM), Mode: 0o644}},
			"private key not found",
		},
		{
			"chain empty",
			map[string]*fstest.MapFile{
				"certs/fullchain.pem": {Data: nil, Mode: 0o644},
				"certs/privkey.pem":   {Data: []byte(validPEM), Mode: 0o600},
			},
			"is empty",
		},
		{
			"chain is not PEM",
			map[string]*fstest.MapFile{
				"certs/fullchain.pem": {Data: []byte("\x30\x82\x04\xa3binary der"), Mode: 0o644},
				"certs/privkey.pem":   {Data: []byte(validPEM), Mode: 0o600},
			},
			"is not PEM encoded",
		},
		{
			"chain is a directory",
			map[string]*fstest.MapFile{
				"certs/fullchain.pem/inner": {Data: []byte("x"), Mode: 0o644},
				"certs/privkey.pem":         {Data: []byte(validPEM), Mode: 0o600},
			},
			"is a directory",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := newManagerWithFS(paths.Layout{Root: "/srv"}, certFS(tc.files))
			err := m.Validate(customConfig("/certs"))
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("Validate() error = %v, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

func TestValidateWarnsOnLoosePrivateKeyPermissions(t *testing.T) {
	fsys := certFS(map[string]*fstest.MapFile{
		"certs/fullchain.pem": {Data: []byte(validPEM), Mode: 0o644},
		"certs/privkey.pem":   {Data: []byte(validPEM), Mode: 0o644},
	})
	m := newManagerWithFS(paths.Layout{Root: "/srv"}, fsys)

	c := customConfig("/certs")
	if err := m.Validate(c); err != nil {
		t.Fatalf("Validate() error = %v, a loose key must warn rather than fail", err)
	}
	if len(c.Warnings) != 1 || !strings.Contains(c.Warnings[0], "readable beyond its owner") {
		t.Fatalf("Warnings = %v", c.Warnings)
	}
}

func TestValidateUnresolvedConfigFails(t *testing.T) {
	m := newManagerWithFS(paths.Layout{Root: "/srv"}, certFS(nil))
	c := &Config{Strategy: StrategyCustomCerts}
	err := m.Validate(c)
	if err == nil || !strings.Contains(err.Error(), "resolve the configuration first") {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestValidateUnknownStrategy(t *testing.T) {
	m := NewManager(paths.Layout{Root: t.TempDir()})
	if err := m.Validate(&Config{Strategy: Strategy("nope")}); err == nil {
		t.Fatal("Validate() error = nil for an unknown strategy")
	}
}

// erroringFS makes Stat succeed but Open fail, covering the read-error branch.
type erroringFS struct{ fakeFS }

func (erroringFS) Open(string) (fs.File, error) { return nil, fs.ErrPermission }

func TestValidateOpenError(t *testing.T) {
	base := certFS(map[string]*fstest.MapFile{
		"certs/fullchain.pem": {Data: []byte(validPEM), Mode: 0o644, ModTime: time.Now()},
		"certs/privkey.pem":   {Data: []byte(validPEM), Mode: 0o600},
	})
	m := newManagerWithFS(paths.Layout{Root: "/srv"}, erroringFS{base})

	err := m.Validate(customConfig("/certs"))
	if err == nil || !strings.Contains(err.Error(), "read certificate chain") {
		t.Fatalf("Validate() error = %v", err)
	}
}

// permissionStatFS makes Stat fail with a non-NotExist error.
type permissionStatFS struct{ fakeFS }

func (permissionStatFS) Stat(string) (fs.FileInfo, error) { return nil, fs.ErrPermission }

func TestValidateStatPermissionError(t *testing.T) {
	m := newManagerWithFS(paths.Layout{Root: "/srv"}, permissionStatFS{certFS(nil)})
	err := m.Validate(customConfig("/certs"))
	if err == nil || !strings.Contains(err.Error(), "inspect certificate chain") {
		t.Fatalf("Validate() error = %v, want the permission failure to surface", err)
	}
}

func TestContainerPaths(t *testing.T) {
	var s CertSource
	if s.ContainerChainFile() != "/etc/caddy/certs/fullchain.pem" {
		t.Errorf("ContainerChainFile() = %q", s.ContainerChainFile())
	}
	if s.ContainerKeyFile() != "/etc/caddy/certs/privkey.pem" {
		t.Errorf("ContainerKeyFile() = %q", s.ContainerKeyFile())
	}
}
