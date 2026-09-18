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
	Environment string
	Port        string
	Database    DatabaseConfig
	OIDC        OIDCConfig
	CORS        CORSConfig
	// InternalToken is the shared secret (ALFHEIM_INTERNAL_TOKEN) guarding the
	// service-to-service membership API. Empty disables that API (503).
	InternalToken string
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

// CORSConfig holds CORS origin allowlist configuration.
type CORSConfig struct {
	AllowedOrigins []string
}

// Load fetches configurations from environment variables with sensible defaults.
func Load() (*Config, error) {
	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", "development")

	dbURL := getEnv("DATABASE_URL", "postgres://household_user:postgres@localhost:5432/alfheim_household?sslmode=disable")
	maxConns := getEnvAsInt32("DB_MAX_CONNS", 25)
	minConns := getEnvAsInt32("DB_MIN_CONNS", 5)
	maxConnLifetimeMinutes := getEnvAsInt32("DB_MAX_CONN_LIFETIME_MINUTES", 30)
	migrationsDir := getEnv("MIGRATIONS_DIR", "migrations")

	oidcIssuerURL := strings.TrimRight(getEnv("OIDC_ISSUER_URL", "http://localhost:8080"), "/")
	oidcAudience := getEnv("OIDC_AUDIENCE", "alfheim")

	internalToken := strings.TrimSpace(os.Getenv("ALFHEIM_INTERNAL_TOKEN"))

	// Parse CORS allowed origins from environment variable
	corsOriginsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://alfheim.loegien.localhost,http://api.alfheim.loegien.localhost")
	corsOrigins := []string{}
	if corsOriginsStr != "" {
		corsOrigins = strings.Split(corsOriginsStr, ",")
		for i := range corsOrigins {
			corsOrigins[i] = strings.TrimSpace(corsOrigins[i])
		}
	}

	cfg := &Config{
		Environment:   env,
		Port:          port,
		InternalToken: internalToken,
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
