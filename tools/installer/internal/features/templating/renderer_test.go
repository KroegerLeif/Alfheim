package templating

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/security"
	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

// update rewrites the golden files instead of comparing against them:
//
//	go test ./internal/features/templating/... -run TestRender -update
var update = flag.Bool("update", false, "rewrite golden files")

// fixedTime keeps rendered output deterministic across runs.
var fixedTime = time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)

// stableSecrets returns predictable stand-ins for generated credentials, so a
// golden file never contains real entropy.
func stableSecrets() map[string]string {
	out := map[string]string{}
	for _, key := range security.Keys() {
		out[key] = "test-" + strings.ToLower(key)
	}
	// Exercise the quoting path with a value that would otherwise be
	// interpolated by Docker Compose.
	out["GRAFANA_ADMIN_PASSWORD"] = `p$ss"wo rd#=`
	return out
}

func model(t *testing.T, preset onboarding.PresetID, tlsCfg tls.Config) Model {
	t.Helper()

	var on onboarding.Config
	if !onboarding.ApplyPreset(&on, preset) {
		t.Fatalf("unknown preset %s", preset)
	}
	if preset == onboarding.PresetCustom {
		on.BaseDomain = "example.com"
		on.AppHost = "alfheim.example.com"
	}
	on.AdminEmail = "ops@example.com"
	if err := onboarding.Derive(&on); err != nil {
		t.Fatal(err)
	}
	if err := onboarding.Validate(on); err != nil {
		t.Fatal(err)
	}

	m := NewManagerFor(t, tlsCfg)
	return Model{
		Onboarding: on,
		TLS:        m,
		Secrets:    stableSecrets(),
		Version:    "v0.0.0-test",
		Generated:  fixedTime,

		DockerSocketGID: "998",
	}
}

// NewManagerFor resolves a TLS config against a throwaway install root.
func NewManagerFor(t *testing.T, cfg tls.Config) tls.Config {
	t.Helper()
	layout := paths.Layout{Root: t.TempDir()}
	if err := tls.NewManager(layout).Resolve(&cfg); err != nil {
		t.Fatalf("resolve TLS config: %v", err)
	}
	return cfg
}

func TestRenderGoldenFiles(t *testing.T) {
	cases := []struct {
		name   string
		preset onboarding.PresetID
		tls    tls.Config
	}{
		{
			"loegien_hetzner",
			onboarding.PresetLoegien,
			tls.Config{
				Strategy:  tls.StrategyHetznerDNS,
				APIToken:  "hetzner-test-token",
				ACMEEmail: "ops@loegien.de",
			},
		},
		{
			"loegien_desec",
			onboarding.PresetLoegien,
			tls.Config{
				Strategy:  tls.StrategyDesecDNS,
				APIToken:  "desec-test-token",
				ACMEEmail: "ops@loegien.de",
			},
		},
		{
			"custom_cloudflare",
			onboarding.PresetCustom,
			tls.Config{
				Strategy: tls.StrategyCloudflareDNS,
				APIToken: "cloudflare-test-token",
			},
		},
		{
			"custom_certs_default_path",
			onboarding.PresetCustom,
			tls.Config{
				Strategy:   tls.StrategyCustomCerts,
				CertSource: tls.CertSource{Mode: tls.CertModeDefault},
			},
		},
		{
			"custom_certs_host_path",
			onboarding.PresetCustom,
			tls.Config{
				Strategy: tls.StrategyCustomCerts,
				CertSource: tls.CertSource{
					Mode:     tls.CertModeHostPath,
					HostPath: "/etc/letsencrypt/live/example.com",
				},
			},
		},
		{
			// A real domain with the internal CA: the combination the
			// alfheim.loegien.de PKCE login failure was reported against.
			"custom_internal_secure",
			onboarding.PresetCustom,
			tls.Config{Strategy: tls.StrategyInternal},
		},
		{
			"localhost_internal",
			onboarding.PresetLocalhost,
			tls.Config{Strategy: tls.StrategyInternal},
		},
	}

	r, err := NewRenderer()
	if err != nil {
		t.Fatalf("NewRenderer() error = %v", err)
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := model(t, tc.preset, tc.tls)

			env, err := r.RenderEnv(m)
			if err != nil {
				t.Fatalf("RenderEnv() error = %v", err)
			}
			caddy, err := r.RenderCaddyfile(m)
			if err != nil {
				t.Fatalf("RenderCaddyfile() error = %v", err)
			}

			assertGolden(t, filepath.Join("testdata", "golden", tc.name, "env.golden"), env)
			assertGolden(t, filepath.Join("testdata", "golden", tc.name, "Caddyfile.golden"), caddy)
		})
	}
}

// TestRenderEnvStorageMatchesRustFS guards the S3 wiring: RustFS only knows
// its root account, so the credentials the applications use must equal it,
// and the endpoint must name the `rustfs` compose service (no `minio` service
// exists).
func TestRenderEnvStorageMatchesRustFS(t *testing.T) {
	secrets, err := security.GenerateAll(security.NewGenerator(), nil)
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLocalhost, tls.Config{Strategy: tls.StrategyInternal})
	m.Secrets = secrets

	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	rendered, err := r.RenderEnv(m)
	if err != nil {
		t.Fatal(err)
	}
	env, err := envfile.Parse(bytes.NewReader(rendered))
	if err != nil {
		t.Fatal(err)
	}

	if env["S3_ACCESS_KEY"] != env["S3_ROOT_USER"] {
		t.Errorf("S3_ACCESS_KEY = %q, want the root user %q", env["S3_ACCESS_KEY"], env["S3_ROOT_USER"])
	}
	if env["S3_SECRET_KEY"] == "" || env["S3_SECRET_KEY"] != env["S3_ROOT_PASSWORD"] {
		t.Error("S3_SECRET_KEY must equal S3_ROOT_PASSWORD")
	}
	for _, key := range []string{"S3_ENDPOINT", "S3_ENDPOINT_URL"} {
		if env[key] != "http://rustfs:9000" {
			t.Errorf("%s = %q, want http://rustfs:9000", key, env[key])
		}
	}
}

// assertGolden compares got against the golden file, or rewrites it.
func assertGolden(t *testing.T, path string, got []byte) {
	t.Helper()

	if *update {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}

	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden file: %v (re-run with -update to create it)", err)
	}
	if diff := cmp.Diff(string(want), string(got)); diff != "" {
		t.Errorf("rendered output differs from %s (-want +got):\n%s", path, diff)
	}
}

func TestRenderedEnvIsParsableAndComplete(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLoegien, tls.Config{
		Strategy: tls.StrategyHetznerDNS, APIToken: "tok", ACMEEmail: "ops@example.com",
	})

	rendered, err := r.RenderEnv(m)
	if err != nil {
		t.Fatal(err)
	}
	vars, err := envfile.Parse(strings.NewReader(string(rendered)))
	if err != nil {
		t.Fatalf("the rendered .env does not parse: %v", err)
	}

	// Every variable the repository template declares must be present, or the
	// stack starts with Compose defaults instead of the generated values.
	// Exceptions are keys .env.example itself documents as local-dev-only
	// tooling that production installs never need (see its comments).
	devOnlyEnvKeys := map[string]bool{
		"ZITADEL_BOOTSTRAP_USERNAME": true,
		// Superseded by the single provisioned ALFHEIM_WEB_CLIENT_ID shared by
		// every frontend (issue #452); .env.example still documents them for
		// the dev compose stack, which this installer does not render.
		"NEXT_PUBLIC_OIDC_CLIENT_ID":    true,
		"NEXT_PUBLIC_OIDC_REDIRECT_URI": true,
	}
	reference, err := envfile.ParseFile(filepath.Join("..", "..", "..", "..", "..", ".env.example"))
	if err != nil {
		t.Skipf("repository .env.example not reachable: %v", err)
	}
	for key := range reference {
		if devOnlyEnvKeys[key] {
			continue
		}
		if _, ok := vars[key]; !ok {
			t.Errorf("the rendered .env is missing %s, which .env.example declares", key)
		}
	}

	// Every generated secret must have survived rendering intact.
	for _, key := range security.Keys() {
		if vars[key] == "" {
			t.Errorf("secret %s is empty in the rendered .env", key)
		}
	}
}

func TestRenderedEnvQuotesHostileValues(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLoegien, tls.Config{
		Strategy: tls.StrategyInternal,
	})

	rendered, err := r.RenderEnv(m)
	if err != nil {
		t.Fatal(err)
	}
	vars, err := envfile.Parse(strings.NewReader(string(rendered)))
	if err != nil {
		t.Fatal(err)
	}
	// The raw value must round-trip, dollar sign and quotes included.
	if got := vars["GRAFANA_ADMIN_PASSWORD"]; got != `p$ss"wo rd#=` {
		t.Fatalf("GRAFANA_ADMIN_PASSWORD = %q, want the original value", got)
	}
}

func TestRenderedCaddyfileNeverContainsTheAPIToken(t *testing.T) {
	// Tokens belong in .env and are referenced as {env.NAME}; a token baked
	// into the Caddyfile would leak through any config backup.
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	for _, strategy := range []tls.Strategy{tls.StrategyHetznerDNS, tls.StrategyCloudflareDNS, tls.StrategyDesecDNS} {
		m := model(t, onboarding.PresetLoegien, tls.Config{
			Strategy: strategy, APIToken: "super-secret-token", ACMEEmail: "ops@example.com",
		})
		caddy, err := r.RenderCaddyfile(m)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(caddy), "super-secret-token") {
			t.Errorf("%s: the rendered Caddyfile contains the raw API token", strategy)
		}
		if !strings.Contains(string(caddy), "{env."+strategy.TokenEnvVar()+"}") {
			t.Errorf("%s: the Caddyfile should reference the token via the environment", strategy)
		}
	}
}

func TestWriteAllPermissions(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	layout := paths.Layout{Root: t.TempDir()}
	m := model(t, onboarding.PresetLoegien, tls.Config{Strategy: tls.StrategyInternal})

	if err := r.WriteAll(layout, m); err != nil {
		t.Fatalf("WriteAll() error = %v", err)
	}

	envInfo, err := os.Stat(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if perm := envInfo.Mode().Perm(); perm != 0o600 {
		t.Errorf(".env permissions = %04o, want 0600", perm)
	}

	caddyInfo, err := os.Stat(layout.Caddyfile())
	if err != nil {
		t.Fatal(err)
	}
	if perm := caddyInfo.Mode().Perm(); perm != 0o644 {
		t.Errorf("Caddyfile permissions = %04o, want 0644", perm)
	}
}

func TestWriteAllTightensPermissionsOnRerun(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	layout := paths.Layout{Root: t.TempDir()}
	m := model(t, onboarding.PresetLoegien, tls.Config{Strategy: tls.StrategyInternal})

	// A .env left world-readable by an earlier run must be tightened, not
	// silently preserved: os.WriteFile alone would leave the old mode.
	if err := os.WriteFile(layout.EnvFile(), []byte("OLD=1"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := r.WriteAll(layout, m); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(layout.EnvFile())
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf(".env permissions = %04o, want 0600", perm)
	}
}

func TestWriteAllFailsOnUnwritableRoot(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	// A regular file where the infrastructure directory belongs.
	if err := os.WriteFile(filepath.Join(root, "infrastructure"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLoegien, tls.Config{Strategy: tls.StrategyInternal})
	if err := r.WriteAll(paths.Layout{Root: root}, m); err == nil {
		t.Fatal("WriteAll() error = nil, want a failure")
	}
}

func TestEnvQuote(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"plain", "abc123", "abc123"},
		{"dollar", "a$b", "'a$b'"},
		{"double quote", `a"b`, `'a"b'`},
		{"backtick", "a`b", "'a`b'"},
		{"space", "a b", "'a b'"},
		{"hash", "a#b", "'a#b'"},
		{"equals", "a=b", "'a=b'"},
		{"backslash", `a\b`, `'a\b'`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := EnvQuote(tc.in)
			if err != nil {
				t.Fatalf("EnvQuote(%q) error = %v", tc.in, err)
			}
			if got != tc.want {
				t.Fatalf("EnvQuote(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestEnvQuoteRejectsSingleQuote(t *testing.T) {
	// A dotenv file has no escape for a single quote inside a single-quoted
	// value, so rendering must fail rather than emit something Compose would
	// misparse. The secret generator never produces one.
	if _, err := EnvQuote("a'b"); err == nil {
		t.Fatal("EnvQuote() error = nil, want a failure for an unrepresentable value")
	}
}

func TestRenderFailsOnUnrepresentableSecret(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetLoegien, tls.Config{Strategy: tls.StrategyInternal})
	m.Secrets["POSTGRES_PASSWORD"] = "has'quote"

	if _, err := r.RenderEnv(m); err == nil {
		t.Fatal("RenderEnv() error = nil, want the template to abort")
	}
}

func TestModelAccessors(t *testing.T) {
	m := Model{
		Secrets:   map[string]string{"A": "x"},
		Generated: fixedTime,
	}
	if m.Secret("A") != "x" {
		t.Error("Secret() should return the stored value")
	}
	if m.Secret("MISSING") != "" {
		t.Error("Secret() should return an empty string for an unknown key")
	}
	if m.GeneratedStamp() != "2026-03-01T12:00:00Z" {
		t.Errorf("GeneratedStamp() = %q", m.GeneratedStamp())
	}
	if m.ExternalPort() != "80" {
		t.Errorf("ExternalPort() = %q, want 80 for an insecure install", m.ExternalPort())
	}
	m.Onboarding.Secure = true
	if m.ExternalPort() != "443" {
		t.Errorf("ExternalPort() = %q, want 443 for a secure install", m.ExternalPort())
	}
	if len(m.APIRoutes()) == 0 {
		t.Error("APIRoutes() must not be empty")
	}
}

// TestRenderedExtraCAFileContract pins the contract with compose.prod.yaml
// and the backends: only the internal strategy points ALFHEIM_EXTRA_CA_FILE
// at the mounted root CA, every other strategy renders it empty, and the
// internal Caddyfile signs with the mounted root.
func TestRenderedExtraCAFileContract(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range tls.Strategies {
		t.Run(string(s.ID), func(t *testing.T) {
			cfg := tls.Config{Strategy: s.ID, APIToken: "tok"}
			m := model(t, onboarding.PresetCustom, cfg)

			env, err := r.RenderEnv(m)
			if err != nil {
				t.Fatal(err)
			}
			vars, err := envfile.Parse(strings.NewReader(string(env)))
			if err != nil {
				t.Fatal(err)
			}
			got, ok := vars["ALFHEIM_EXTRA_CA_FILE"]
			if !ok {
				t.Fatal("ALFHEIM_EXTRA_CA_FILE is missing")
			}
			want := ""
			if s.ID == tls.StrategyInternal {
				want = "/etc/alfheim/ca/alfheim-root-ca.crt"
			}
			if got != want || m.ExtraCAFile() != want {
				t.Errorf("ALFHEIM_EXTRA_CA_FILE = %q, want %q", got, want)
			}

			caddy, err := r.RenderCaddyfile(m)
			if err != nil {
				t.Fatal(err)
			}
			signsWithRoot := strings.Contains(string(caddy), "cert /etc/caddy/pki/root.crt") &&
				strings.Contains(string(caddy), "key /etc/caddy/pki/root.key")
			if signsWithRoot != (s.ID == tls.StrategyInternal) {
				t.Errorf("Caddyfile references the generated root = %t for %s", signsWithRoot, s.ID)
			}
			if !strings.Contains(string(caddy), "https://auth.example.com {") ||
				!strings.Contains(string(caddy), "http://auth.example.com {\n\tredir https://") {
				t.Errorf("the %s Caddyfile must serve HTTPS with an explicit HTTP redirect", s.ID)
			}
		})
	}
}

// TestRenderedCaddyfileSecurityHeaders pins the gateway hardening contract:
// every site block imports the shared header snippet, HSTS is only emitted
// when the install actually serves HTTPS, and the snippet never overrides
// headers an upstream (Zitadel, Grafana) already sends.
func TestRenderedCaddyfileSecurityHeaders(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range tls.Strategies {
		t.Run(string(s.ID), func(t *testing.T) {
			m := model(t, onboarding.PresetCustom, tls.Config{Strategy: s.ID, APIToken: "tok"})
			out, err := r.RenderCaddyfile(m)
			if err != nil {
				t.Fatal(err)
			}
			caddy := string(out)

			if got := strings.Count(caddy, "\timport security_headers\n"); got != 2 {
				t.Errorf("security_headers is imported %d times, want 2 (auth host and app host)", got)
			}
			for _, want := range []string{
				"?X-Content-Type-Options \"nosniff\"",
				"?Referrer-Policy \"strict-origin-when-cross-origin\"",
				"?X-Frame-Options \"SAMEORIGIN\"",
				"?Permissions-Policy ",
				"?Content-Security-Policy \"frame-ancestors 'self'\"",
				"?Content-Security-Policy-Report-Only ",
				"-Server\n",
			} {
				if !strings.Contains(caddy, want) {
					t.Errorf("the %s Caddyfile lacks %q", s.ID, want)
				}
			}
			if strings.Contains(caddy, "\n\t\tContent-Security-Policy ") {
				t.Error("the enforced CSP must use the ? prefix so upstream policies win")
			}

			hasHSTS := strings.Contains(caddy, "Strict-Transport-Security \"max-age=31536000; includeSubDomains\"")
			if hasHSTS != m.Onboarding.Secure {
				t.Errorf("HSTS present = %t, but Secure = %t", hasHSTS, m.Onboarding.Secure)
			}
		})
	}
}

// TestRenderedCaddyfileRouting pins the API routing contract shared with
// infrastructure/caddy/Caddyfile (issue #650): the gateway only routes, so
// there are no locale redirects, shopping/chores/library/chat are forwarded
// unchanged on /api/v1/<slug>, and the dashboard catch-all keeps the path.
func TestRenderedCaddyfileRouting(t *testing.T) {
	r, err := NewRenderer()
	if err != nil {
		t.Fatal(err)
	}
	m := model(t, onboarding.PresetCustom, tls.Config{Strategy: tls.StrategyInternal})
	out, err := r.RenderCaddyfile(m)
	if err != nil {
		t.Fatal(err)
	}
	caddy := string(out)

	if strings.Contains(caddy, "redir /") {
		t.Error("the gateway must not redirect bare app paths; next-intl owns locale selection")
	}
	for _, want := range []string{
		"\thandle /api/v1/shopping* {\n\t\treverse_proxy shopping-backend:8000\n",
		"\thandle_path /shopping/api/v1* {\n\t\trewrite * /api/v1{path}\n",
		"\thandle /api/v1/chores* {\n\t\treverse_proxy chores-backend:8000\n",
		"\thandle_path /chores/api/v1* {\n\t\trewrite * /api/v1/chores{path}\n",
		"\thandle /api/v1/library* {\n\t\treverse_proxy library-backend:8000\n",
		"\thandle_path /library/api/v1* {\n\t\trewrite * /api/v1/library{path}\n",
		"\thandle /api/v1/chat* {\n\t\treverse_proxy chat-backend:8080\n",
		"\thandle_path /chat/api/v1* {\n\t\trewrite * /api/v1/chat{path}\n",
		"\thandle_path /api/v1/pantry* {\n\t\trewrite * /api/v1{path}\n",
		"\thandle_path /api/v1/budget* {\n\t\trewrite * /api/v1{path}\n",
		"\thandle /api/v1/* {\n\t\treverse_proxy dashboard-backend:8080\n",
		"\thandle /shopping* {\n\t\treverse_proxy shopping-frontend:3010\n",
		"\thandle /pantry* {\n\t\treverse_proxy pantry-frontend:3000\n",
	} {
		if !strings.Contains(caddy, want) {
			t.Errorf("the Caddyfile lacks %q", want)
		}
	}
}
