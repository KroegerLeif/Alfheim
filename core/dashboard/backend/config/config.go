// Package config handles environment variable loading and application configuration management.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config encapsulates all backend service configurations.
type Config struct {
	Environment   string
	Port          string
	Database      DatabaseConfig
	OIDC          OIDCConfig
	StackAppsPath string
}

// DatabaseConfig holds PostgreSQL connection configuration settings.
type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MigrationsDir   string
}

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

	cfg := &Config{
		Environment:   env,
		Port:          port,
		StackAppsPath: stackAppsPath,
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
	}

	return cfg, nil
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
