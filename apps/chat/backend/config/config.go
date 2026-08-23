// Package config handles environment variable loading and application configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"alfheim/chat/internal/shared/crypto"
)

// Config encapsulates all chat-backend service configurations.
type Config struct {
	Environment string
	Port        string
	Database    DatabaseConfig
	Keycloak    KeycloakConfig
	Encryption  EncryptionConfig
	Bootstrap   BootstrapConfig
}

// DatabaseConfig holds PostgreSQL connection configuration settings.
type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MigrationsDir   string
}

// KeycloakConfig holds Keycloak OIDC settings used for bearer token validation.
type KeycloakConfig struct {
	BaseURL          string
	Realm            string
	ClientID         string
	JWKSURL          string
	ExpectedIssuer   string
	ExpectedAudience string
}

// EncryptionConfig holds the symmetric key material used to encrypt model block API keys at rest.
type EncryptionConfig struct {
	// Key is the raw 32-byte AES-256 key decoded from CHAT_ENCRYPTION_KEY (base64).
	Key []byte
	// KeyID identifies which key version encrypted a given ciphertext, enabling future rotation.
	KeyID string
}

// BootstrapConfig holds the optional ENV-based fallback model block created on first startup only.
type BootstrapConfig struct {
	OllamaBaseURL string
	OllamaModel   string
	Provider      string
	APIKey        string
}

// Load fetches configurations from environment variables with sensible defaults.
func Load() (*Config, error) {
	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", "development")

	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/chat_db?sslmode=disable")
	maxConns := getEnvAsInt32("DB_MAX_CONNS", 25)
	minConns := getEnvAsInt32("DB_MIN_CONNS", 5)
	maxConnLifetimeMinutes := getEnvAsInt32("DB_MAX_CONN_LIFETIME_MINUTES", 30)
	migrationsDir := getEnv("MIGRATIONS_DIR", "migrations")

	keycloakBaseURL := getEnv("KEYCLOAK_BASE_URL", "http://keycloak:8080/auth")
	keycloakRealm := getEnv("KEYCLOAK_REALM", "alfheim")
	keycloakClientID := getEnv("KEYCLOAK_CLIENT_ID", "chat-backend")
	keycloakJWKSURL := getEnv("KEYCLOAK_JWKS_URL", fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", keycloakBaseURL, keycloakRealm))
	expectedIssuer := getEnv("KEYCLOAK_PUBLIC_ISSUER", fmt.Sprintf("http://api.alfheim.loegien.localhost/auth/realms/%s", keycloakRealm))
	// Defaults to the client ID: Keycloak's default audience mapper stamps the requesting client id into `aud`.
	expectedAudience := getEnv("KEYCLOAK_EXPECTED_AUDIENCE", keycloakClientID)

	encryptionKeyB64 := getEnv("CHAT_ENCRYPTION_KEY", "")
	encryptionKeyID := getEnv("CHAT_ENCRYPTION_KEY_ID", "v1")

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
			BaseURL:          keycloakBaseURL,
			Realm:            keycloakRealm,
			ClientID:         keycloakClientID,
			JWKSURL:          keycloakJWKSURL,
			ExpectedIssuer:   expectedIssuer,
			ExpectedAudience: expectedAudience,
		},
		Encryption: EncryptionConfig{
			KeyID: encryptionKeyID,
		},
		Bootstrap: BootstrapConfig{
			OllamaBaseURL: getEnv("CHAT_BOOTSTRAP_OLLAMA_URL", ""),
			OllamaModel:   getEnv("CHAT_BOOTSTRAP_MODEL", ""),
			Provider:      getEnv("CHAT_BOOTSTRAP_PROVIDER", "ollama"),
			APIKey:        getEnv("CHAT_BOOTSTRAP_API_KEY", ""),
		},
	}

	if encryptionKeyB64 != "" {
		key, err := crypto.DecodeKey(encryptionKeyB64)
		if err != nil {
			return nil, fmt.Errorf("failed to decode CHAT_ENCRYPTION_KEY: %w", err)
		}
		cfg.Encryption.Key = key
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
