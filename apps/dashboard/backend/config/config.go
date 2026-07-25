// Package config handles environment variable loading and application configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config encapsulates all backend service configurations.
type Config struct {
	Environment string
	Port        string
	Database    DatabaseConfig
	Keycloak    KeycloakConfig
}

// DatabaseConfig holds PostgreSQL connection configuration settings.
type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MigrationsDir   string
}

// KeycloakConfig holds Keycloak OIDC and Admin API settings.
type KeycloakConfig struct {
	BaseURL      string
	Realm        string
	ClientID     string
	ClientSecret string
	JWKSURL      string
}

// Load fetches configurations from environment variables with sensible defaults.
func Load() (*Config, error) {
	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", "development")

	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dashboard_db?sslmode=disable")
	maxConns := getEnvAsInt32("DB_MAX_CONNS", 25)
	minConns := getEnvAsInt32("DB_MIN_CONNS", 5)
	maxConnLifetimeMinutes := getEnvAsInt32("DB_MAX_CONN_LIFETIME_MINUTES", 30)
	migrationsDir := getEnv("MIGRATIONS_DIR", "migrations")

	keycloakBaseURL := getEnv("KEYCLOAK_BASE_URL", "http://localhost:8080")
	keycloakRealm := getEnv("KEYCLOAK_REALM", "loeger-os")
	keycloakClientID := getEnv("KEYCLOAK_CLIENT_ID", "dashboard-backend")
	keycloakClientSecret := getEnv("KEYCLOAK_CLIENT_SECRET", "")
	keycloakJWKSURL := getEnv("KEYCLOAK_JWKS_URL", fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", keycloakBaseURL, keycloakRealm))

	cfg := &Config{
		Environment: env,
		Port:        port,
		Database: DatabaseConfig{
			URL:             dbURL,
			MaxConns:        maxConns,
			MinConns:        minConns,
			MaxConnLifetime: time.Duration(maxConnLifetimeMinutes) * time.Minute,
			MigrationsDir:   migrationsDir,
		},
		Keycloak: KeycloakConfig{
			BaseURL:      keycloakBaseURL,
			Realm:        keycloakRealm,
			ClientID:     keycloakClientID,
			ClientSecret: keycloakClientSecret,
			JWKSURL:      keycloakJWKSURL,
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
