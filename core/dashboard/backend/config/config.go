// Package config handles environment variable loading and application configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"alfheim/go-shared/crypto"
	"alfheim/go-shared/db"
	"alfheim/go-shared/httpmw"
	"alfheim/go-shared/netguard"
)

// Config encapsulates all backend service configurations.
type Config struct {
	Environment   string
	Port          string
	Database      DatabaseConfig
	OIDC          OIDCConfig
	CORS          CORSConfig
	StackAppsPath string
	// EnabledApps is the raw ALFHEIM_ENABLED_APPS value: the optional apps
	// the installation runs, or "all" when the variable is unset (the
	// installer default for installations from before the Lean Core).
	EnabledApps string
	Household   HouseholdConfig
	// Integrations configures the typed plugin framework (ADR 0010).
	Integrations IntegrationsConfig
}

// IntegrationsConfig holds the settings of the typed plugins: the key that
// encrypts their credentials and the operator's outbound allowlist.
type IntegrationsConfig struct {
	// EncryptionKey is the raw 32-byte AES-256 key decoded from
	// INTEGRATIONS_ENCRYPTION_KEY (base64). Empty means credentials can be
	// neither stored nor read; the dashboard still starts (fail closed for
	// secrets only). A set but malformed key fails startup.
	EncryptionKey []byte
	// EncryptionKeyID is INTEGRATIONS_ENCRYPTION_KEY_ID (default "v1"), stored
	// with each row so keys can be rotated.
	EncryptionKeyID string
	// AllowedHosts is INTEGRATIONS_ALLOWED_HOSTS, the comma-separated netguard
	// allowlist of private hosts, IP addresses and CIDR ranges plugins may
	// reach. Empty allows public destinations only.
	AllowedHosts string
	// Principal holds the client credentials of the alfheim-integrations
	// machine user (#958) that plugin actions run as.
	Principal PrincipalConfig
	// ChoresURL is INTEGRATIONS_CHORES_URL, the chores backend that plugin
	// actions call through its public API (default http://chores-backend:8000).
	ChoresURL string
}

// HouseholdConfig locates core/household's internal membership API, which
// confirms the household of household-scoped routes such as launchers.
type HouseholdConfig struct {
	// InternalURL is HOUSEHOLD_INTERNAL_URL (default http://household-backend:8080).
	InternalURL string
	// InternalToken is ALFHEIM_INTERNAL_TOKEN, the shared service-to-service secret.
	// Required: without it every household-scoped request would fail with 503.
	InternalToken string
}

// DatabaseConfig holds PostgreSQL connection configuration settings. It is the
// shared go-shared/db configuration, so it can be handed to db.NewClient as is.
type DatabaseConfig = db.Config

// OIDCConfig holds the generic OpenID Connect verification settings.
//
// The middleware discovers the JWKS URI dynamically from
// {IssuerURL}/.well-known/openid-configuration and validates the token
// signature, issuer, audience and expiration.
type OIDCConfig struct {
	// IssuerURL is the canonical OIDC issuer. Access tokens must carry an
	// `iss` claim exactly matching this value, and the OIDC discovery
	// document is fetched relative to it.
	IssuerURL string
	// Audience is the expected value contained in the token `aud` claim.
	Audience string
}

// CORSConfig holds CORS origin allowlist configuration.
type CORSConfig struct {
	AllowedOrigins []string
}

// Load fetches configurations from environment variables with sensible defaults.
func Load() (*Config, error) {
	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", "development")

	dbURL := getEnv("DATABASE_URL", "postgres://dashboard_user:postgres@localhost:5432/alfheim_dashboard?sslmode=disable")
	maxConns := getEnvAsInt32("DB_MAX_CONNS", 25)
	minConns := getEnvAsInt32("DB_MIN_CONNS", 5)
	maxConnLifetimeMinutes := getEnvAsInt32("DB_MAX_CONN_LIFETIME_MINUTES", 30)
	migrationsDir := getEnv("MIGRATIONS_DIR", "migrations")

	oidcIssuerURL := strings.TrimRight(getEnv("OIDC_ISSUER_URL", "http://localhost:8080"), "/")
	oidcAudience := getEnv("OIDC_AUDIENCE", "alfheim")

	stackAppsPath := getEnv("STACK_APPS_PATH", "deploy/stack-apps.yaml")

	// An empty ALFHEIM_ENABLED_APPS is the Lean Core, so only a missing
	// variable falls back to every app; getEnv would treat both alike.
	enabledApps, ok := os.LookupEnv("ALFHEIM_ENABLED_APPS")
	if !ok {
		enabledApps = "all"
	}

	// CORS allowlist (#921): production allows no cross-origin access unless
	// CORS_ALLOWED_ORIGINS names the public origins; a malformed entry fails
	// startup instead of widening the list.
	corsRaw, corsSet := os.LookupEnv("CORS_ALLOWED_ORIGINS")
	corsOrigins, err := httpmw.ResolveAllowedOrigins(corsRaw, corsSet, env)
	if err != nil {
		return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS: %w", err)
	}

	cfg := &Config{
		Environment:   env,
		Port:          port,
		StackAppsPath: stackAppsPath,
		EnabledApps:   enabledApps,
		Database: DatabaseConfig{
			URL:             dbURL,
			MaxConns:        maxConns,
			MinConns:        minConns,
			MaxConnLifetime: time.Duration(maxConnLifetimeMinutes) * time.Minute,
			MigrationsDir:   migrationsDir,
		},
		OIDC: OIDCConfig{
			IssuerURL: oidcIssuerURL,
			Audience:  oidcAudience,
		},
		CORS: CORSConfig{
			AllowedOrigins: corsOrigins,
		},
		Household: HouseholdConfig{
			InternalURL:   strings.TrimRight(getEnv("HOUSEHOLD_INTERNAL_URL", "http://household-backend:8080"), "/"),
			InternalToken: getEnv("ALFHEIM_INTERNAL_TOKEN", ""),
		},
	}

	if strings.TrimSpace(cfg.Household.InternalToken) == "" {
		return nil, fmt.Errorf("ALFHEIM_INTERNAL_TOKEN is required to verify household membership")
	}

	integrations, err := loadIntegrations()
	if err != nil {
		return nil, err
	}
	cfg.Integrations = integrations

	return cfg, nil
}

// loadIntegrations reads the INTEGRATIONS_* variables. A malformed key or
// allowlist fails startup instead of silently weakening the boundary.
func loadIntegrations() (IntegrationsConfig, error) {
	out := IntegrationsConfig{
		EncryptionKeyID: strings.TrimSpace(getEnv("INTEGRATIONS_ENCRYPTION_KEY_ID", "v1")),
		AllowedHosts:    strings.TrimSpace(os.Getenv("INTEGRATIONS_ALLOWED_HOSTS")),
		ChoresURL:       strings.TrimRight(getEnv("INTEGRATIONS_CHORES_URL", "http://chores-backend:8000"), "/"),
		Principal: PrincipalConfig{
			PrincipalID:  strings.TrimSpace(os.Getenv("INTEGRATIONS_PRINCIPAL_ID")),
			ClientID:     strings.TrimSpace(os.Getenv("INTEGRATIONS_CLIENT_ID")),
			ClientSecret: strings.TrimSpace(os.Getenv("INTEGRATIONS_CLIENT_SECRET")),
			ProjectID:    strings.TrimSpace(os.Getenv("ZITADEL_PROJECT_ID")),
		},
	}
	if raw := strings.TrimSpace(os.Getenv("INTEGRATIONS_ENCRYPTION_KEY")); raw != "" {
		key, err := crypto.DecodeKey(raw)
		if err != nil {
			return IntegrationsConfig{}, fmt.Errorf("INTEGRATIONS_ENCRYPTION_KEY: %w", err)
		}
		out.EncryptionKey = key
	}
	if _, err := netguard.New(out.AllowedHosts); err != nil {
		return IntegrationsConfig{}, fmt.Errorf("INTEGRATIONS_ALLOWED_HOSTS: %w", err)
	}
	return out, nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}

func getEnvAsInt32(key string, fallback int32) int32 {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return fallback
	}
	val, err := strconv.ParseInt(valueStr, 10, 32)
	if err != nil {
		return fallback
	}
	return int32(val)
}
