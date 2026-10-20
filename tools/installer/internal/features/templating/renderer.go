// Package templating renders the .env and Caddyfile an installation needs
// from embedded templates, so the installer binary is fully self-contained.
package templating

import (
	"bytes"
	"embed"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"alfheim/installer/internal/features/onboarding"
	"alfheim/installer/internal/features/tls"
	"alfheim/installer/internal/shared/paths"
)

//go:embed embedded/*.tmpl
var templates embed.FS

// Model is the flattened view handed to both templates.
type Model struct {
	Onboarding onboarding.Config
	TLS        tls.Config
	Secrets    map[string]string
	Version    string
	// DockerSocketGID is the numeric group id owning the host's Docker
	// socket (DOCKER_SOCKET_GID). Empty when it could not be detected.
	DockerSocketGID string
	// Generated is injected rather than read from the clock, so that golden
	// file comparisons stay deterministic.
	Generated time.Time
}

// Secret returns a generated secret, or the empty string when absent.
func (m Model) Secret(key string) string { return m.Secrets[key] }

// GeneratedStamp renders the generation timestamp in UTC.
func (m Model) GeneratedStamp() string {
	return m.Generated.UTC().Format(time.RFC3339)
}

// ExternalPort is the port Zitadel advertises in its issuer metadata.
func (m Model) ExternalPort() string {
	if m.Onboarding.Secure {
		return "443"
	}
	return "80"
}

// ExtraCAFile is the container path of the generated root CA's public copy
// (ALFHEIM_EXTRA_CA_FILE), empty for strategies with a publicly trusted
// certificate.
func (m Model) ExtraCAFile() string {
	if m.TLS.Strategy == tls.StrategyInternal {
		return tls.LocalCAContainerTrustFile
	}
	return ""
}

// Renderer produces the generated configuration files.
type Renderer interface {
	RenderEnv(m Model) ([]byte, error)
	RenderCaddyfile(m Model) ([]byte, error)
	WriteAll(l paths.Layout, m Model) error
}

// TemplateRenderer renders from the embedded templates.
type TemplateRenderer struct {
	tpl *template.Template
}

// NewRenderer parses the embedded templates.
func NewRenderer() (*TemplateRenderer, error) {
	tpl, err := template.New("alfheim").
		Funcs(template.FuncMap{
			"envQuote": EnvQuote,
			"join":     strings.Join,
			"urlQuery": url.QueryEscape,
		}).
		ParseFS(templates, "embedded/*.tmpl")
	if err != nil {
		return nil, fmt.Errorf("templating: parse embedded templates: %w", err)
	}
	return &TemplateRenderer{tpl: tpl}, nil
}

// RenderEnv renders the production environment file.
func (r *TemplateRenderer) RenderEnv(m Model) ([]byte, error) {
	return r.render("env.tmpl", m)
}

// RenderCaddyfile renders the ingress configuration.
func (r *TemplateRenderer) RenderCaddyfile(m Model) ([]byte, error) {
	return r.render("Caddyfile.tmpl", m)
}

// render executes one named template.
func (r *TemplateRenderer) render(name string, m Model) ([]byte, error) {
	var buf bytes.Buffer
	if err := r.tpl.ExecuteTemplate(&buf, name, m); err != nil {
		return nil, fmt.Errorf("templating: render %s: %w", name, err)
	}
	return buf.Bytes(), nil
}

// WriteAll renders and writes both files into the installation layout.
// The .env holds every credential, so it is written owner-readable only.
func (r *TemplateRenderer) WriteAll(l paths.Layout, m Model) error {
	env, err := r.RenderEnv(m)
	if err != nil {
		return err
	}
	caddy, err := r.RenderCaddyfile(m)
	if err != nil {
		return err
	}

	if err := l.EnsureDirs(); err != nil {
		return err
	}
	if err := writeFile(l.EnvFile(), env, 0o600); err != nil {
		return err
	}
	return writeFile(l.Caddyfile(), caddy, 0o644)
}

// writeFile writes content atomically enough for our purposes and enforces the
// requested permissions even when the file already exists.
func writeFile(path string, content []byte, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("templating: create directory for %s: %w", path, err)
	}
	if err := os.WriteFile(path, content, perm); err != nil {
		return fmt.Errorf("templating: write %s: %w", path, err)
	}
	// WriteFile does not change the mode of an existing file, so a .env left
	// world-readable by an earlier run would stay that way.
	if err := os.Chmod(path, perm); err != nil {
		return fmt.Errorf("templating: set permissions on %s: %w", path, err)
	}
	return nil
}

// EnvQuote renders a value safe to place on the right-hand side of a dotenv
// assignment. Docker Compose interpolates $ and honours double quotes inside
// an env file, so anything risky is wrapped in single quotes, which Compose
// treats as fully literal.
//
// A literal single quote cannot be represented: the dotenv format has no
// escape for it inside a single-quoted value, and the shell idiom '"'"' is
// not understood by Compose's parser. The secret generator never emits one,
// so this returns an error rather than silently producing a file that Compose
// would misparse.
func EnvQuote(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	if strings.Contains(value, "'") {
		return "", fmt.Errorf(
			"templating: value contains a single quote, which a dotenv file cannot represent")
	}
	if !strings.ContainsAny(value, "$\"`\\ \t\n#=") {
		return value, nil
	}
	return "'" + value + "'", nil
}

// APIRoute maps a path prefix on the frontend domain to a backend upstream.
type APIRoute struct {
	Slug     string
	Upstream string
	// FrontendPort is the port the app's Next.js frontend listens on.
	FrontendPort int
	// Direct is true when the backend itself serves /api/v1/<slug>/..., so
	// the gateway forwards that path unchanged. Otherwise the backend serves
	// /api/v1/... and the gateway strips the slug.
	Direct bool
	// BackendPrefix is what /<slug>/api/v1/... is rewritten to before it is
	// proxied: /api/v1 for most apps, /api/v1/<slug> for apps whose routers
	// are mounted under their slug.
	BackendPrefix string
}

// apiRoutes mirrors the Tier-2 application services defined in
// compose.prod.yaml and the routing in infrastructure/caddy/Caddyfile. Both
// the API proxy rules and the frontend handlers are generated from this one
// list so the two can never drift apart.
var apiRoutes = []APIRoute{
	{Slug: "pantry", Upstream: "pantry-backend:8000", FrontendPort: 3000, BackendPrefix: "/api/v1"},
	// The shopping backend serves /api/v1/shopping-lists, /api/v1/shopping/items
	// and /api/v1/shopping-history itself, so /api/v1/shopping* is passed through
	// while /shopping/api/v1/... maps onto /api/v1/.... Its frontend listens on
	// 3010 (PORT in compose.prod.yaml).
	{Slug: "shopping", Upstream: "shopping-backend:8000", FrontendPort: 3010, Direct: true, BackendPrefix: "/api/v1"},
	{Slug: "maintenance", Upstream: "maintenance-backend:8000", FrontendPort: 3000, BackendPrefix: "/api/v1"},
	{Slug: "chores", Upstream: "chores-backend:8000", FrontendPort: 3000, Direct: true, BackendPrefix: "/api/v1/chores"},
	{Slug: "budget", Upstream: "budget-backend:8000", FrontendPort: 3000, BackendPrefix: "/api/v1"},
	{Slug: "workout", Upstream: "workout-backend:8000", FrontendPort: 3000, BackendPrefix: "/api/v1"},
	{Slug: "library", Upstream: "library-backend:8000", FrontendPort: 3000, Direct: true, BackendPrefix: "/api/v1/library"},
	{Slug: "chat", Upstream: "chat-backend:8080", FrontendPort: 3000, Direct: true, BackendPrefix: "/api/v1/chat"},
}

// APIRoutes exposes the application route table to the templates.
func (m Model) APIRoutes() []APIRoute { return apiRoutes }
