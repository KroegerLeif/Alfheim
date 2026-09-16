// Package provisioning reconciles the Zitadel project and OIDC applications
// that the Alfheim stack needs, so a fresh install can log in without a
// manual step in the Zitadel console.
//
// It is the Go replacement for scripts/zitadel-bootstrap.sh: the same
// reconciliation idea (search by name, create if missing, tolerate a
// no-changes response on update, reuse a known-good secret) but implemented
// against the Management API through an injectable Client, so it is
// unit-testable and shared between alfheim-setup and scripts/up.sh.
package provisioning

import (
	"context"
	"fmt"
)

// AppType selects how an OIDC application authenticates.
type AppType int

const (
	// AppTypePublicPKCE is a public, redirect-based SPA client: appType
	// USER_AGENT, authMethodType NONE, PKCE. Used for the one client shared
	// by every frontend.
	AppTypePublicPKCE AppType = iota
	// AppTypeConfidentialWeb is a server-side confidential client with a
	// client secret: appType WEB, authMethodType BASIC. Used for Grafana.
	AppTypeConfidentialWeb
)

// AppSpec declares the OIDC application Provision should reconcile.
type AppSpec struct {
	// Name is the application's display name in Zitadel and the key used to
	// look it up idempotently.
	Name                   string
	Type                   AppType
	RedirectURIs           []string
	PostLogoutRedirectURIs []string
	// DevMode relaxes Zitadel's redirect URI validation (plain HTTP,
	// non-loopback hosts). It must be true whenever the installation is not
	// served over TLS.
	DevMode bool
	// ExistingClientID/-Secret are the credentials the caller already has on
	// file (from a previous run's .env), used to decide whether a secret
	// must be regenerated.
	ExistingClientID     string
	ExistingClientSecret string
}

// Credentials is what Zitadel hands back for a reconciled application.
// Secret is empty for a public client, which has none.
type Credentials struct {
	ClientID     string
	ClientSecret string
}

// Client is the subset of the Zitadel Management API Provision needs. It
// exists so the HTTP implementation can be swapped for a fake in tests.
type Client interface {
	// EnsureProject returns the id of a project named name, creating it if
	// it does not already exist.
	EnsureProject(ctx context.Context, name string) (id string, err error)
	// EnsureOIDCApp reconciles one OIDC application inside projectID and
	// returns its current credentials.
	EnsureOIDCApp(ctx context.Context, projectID string, spec AppSpec) (Credentials, error)
}

// Input is everything Provision needs to compute the desired state. It is
// pure data so orchestrator/run.go and scripts/up.sh's `provision` subcommand
// can build it identically.
type Input struct {
	ProjectName string

	// WebApp is the one public PKCE client shared by the dashboard and every
	// app frontend.
	WebApp AppSpec
	// GrafanaApp is the confidential client used for Grafana's generic OAuth
	// integration.
	GrafanaApp AppSpec
}

// Result carries the ids Provision resolved, in the shape orchestrator/run.go
// writes back into .env.
type Result struct {
	ProjectID       string
	WebClientID     string
	GrafanaClientID string
	GrafanaSecret   string
}

// knownPlaceholderSecrets are values that must never be treated as a real,
// reusable secret. GRAFANA_OIDC_CLIENT_SECRET used to ship a fixed
// development placeholder in scripts/zitadel-bootstrap.sh; keeping the check
// here means an .env carried over from that era still gets a fresh secret.
var knownPlaceholderSecrets = map[string]bool{
	"alfheim-grafana-secret": true,
}

// Provision reconciles the Alfheim project and its OIDC applications against
// c, filling in credentials carried over from existing (typically a parsed
// .env) so that re-running it never rotates a secret still in use.
//
// It is idempotent: run twice with the same input, it makes no further
// changes to Zitadel and returns the same Result.
func Provision(ctx context.Context, c Client, in Input, existing map[string]string) (Result, error) {
	if c == nil {
		return Result{}, fmt.Errorf("provisioning: client must not be nil")
	}
	if in.ProjectName == "" {
		return Result{}, fmt.Errorf("provisioning: project name must not be empty")
	}

	projectID, err := c.EnsureProject(ctx, in.ProjectName)
	if err != nil {
		return Result{}, fmt.Errorf("provisioning: ensure project %q: %w", in.ProjectName, err)
	}

	webSpec := in.WebApp
	webSpec.Type = AppTypePublicPKCE
	webSpec.ExistingClientID = existing["ALFHEIM_WEB_CLIENT_ID"]
	webCreds, err := c.EnsureOIDCApp(ctx, projectID, webSpec)
	if err != nil {
		return Result{}, fmt.Errorf("provisioning: ensure app %q: %w", webSpec.Name, err)
	}

	grafanaSpec := in.GrafanaApp
	grafanaSpec.Type = AppTypeConfidentialWeb
	grafanaSpec.ExistingClientID = existing["GRAFANA_OIDC_CLIENT_ID"]
	grafanaSpec.ExistingClientSecret = existing["GRAFANA_OIDC_CLIENT_SECRET"]
	if knownPlaceholderSecrets[grafanaSpec.ExistingClientSecret] {
		grafanaSpec.ExistingClientSecret = ""
	}
	grafanaCreds, err := c.EnsureOIDCApp(ctx, projectID, grafanaSpec)
	if err != nil {
		return Result{}, fmt.Errorf("provisioning: ensure app %q: %w", grafanaSpec.Name, err)
	}

	return Result{
		ProjectID:       projectID,
		WebClientID:     webCreds.ClientID,
		GrafanaClientID: grafanaCreds.ClientID,
		GrafanaSecret:   grafanaCreds.ClientSecret,
	}, nil
}

// BuildInput assembles the Input for the Alfheim stack from the rendered
// onboarding values, so callers do not have to hand-assemble redirect URI
// lists. baseURL must not have a trailing slash (as onboarding.Config.BaseURL
// never does).
func BuildInput(projectName, baseURL string, devMode bool, appSlugs []string) Input {
	redirects := make([]string, 0, len(appSlugs)+1)
	redirects = append(redirects, baseURL+"/")
	for _, slug := range appSlugs {
		redirects = append(redirects, baseURL+"/"+slug+"/")
	}

	return Input{
		ProjectName: projectName,
		WebApp: AppSpec{
			Name:                   "Alfheim Web",
			RedirectURIs:           redirects,
			PostLogoutRedirectURIs: redirects,
			DevMode:                devMode,
		},
		GrafanaApp: AppSpec{
			Name:                   "Grafana",
			RedirectURIs:           []string{baseURL + "/grafana/login/generic_oauth"},
			PostLogoutRedirectURIs: []string{baseURL + "/grafana/login"},
			DevMode:                devMode,
		},
	}
}

// AppSlugs is the fixed list of application frontends that share the web
// client, in the order redirect URIs are generated. It mirrors the basePath
// each app's next.config.ts/.js declares.
var AppSlugs = []string{
	"pantry", "shopping", "chores", "maintenance",
	"budget", "chat", "workout", "library",
}
