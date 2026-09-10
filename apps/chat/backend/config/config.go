// Package config handles environment variable loading and application configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"alfheim/chat/internal/shared/crypto"
)

// Config encapsulates all chat-backend service configurations.
type Config struct {
	Environment    string
	Port           string
	Database       DatabaseConfig
	OIDC           OIDCConfig
	Encryption     EncryptionConfig
	Bootstrap      BootstrapConfig
	Storage        StorageConfig
	MCPServersSpec string
}

// DatabaseConfig holds PostgreSQL connection configuration settings.
type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MigrationsDir   string
}

// OIDCConfig holds OpenID Connect verification settings used for bearer token validation.
type OIDCConfig struct {
	IssuerURL string
	Audience  string
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

// StorageConfig holds S3/RustFS object storage configuration settings.
type StorageConfig struct {
	Endpoint   string
	AccessKey  string
	SecretKey  string
	BucketName string
	UseSSL     bool
	Region     string
	PublicURL  string
}

// Load fetches configurations from environment variables with sensible defaults.
func Load() (*Config, error) {
	port := getEnv("PORT", "8080")
	env := getEnv("ENVIRONMENT", "development")

	dbURL := getEnv("DATABASE_URL", "postgres://chat_user:postgres@localhost:5432/alfheim_chat?sslmode=disable")
	maxConns := getEnvAsInt32("DB_MAX_CONNS", 25)
	minConns := getEnvAsInt32("DB_MIN_CONNS", 5)
	maxConnLifetimeMinutes := getEnvAsInt32("DB_MAX_CONN_LIFETIME_MINUTES", 30)
	migrationsDir := getEnv("MIGRATIONS_DIR", "migrations")

	oidcIssuerURL := strings.TrimRight(getEnv("OIDC_ISSUER_URL", "http://localhost:8080"), "/")
	oidcAudience := getEnv("OIDC_AUDIENCE", "alfheim")

	encryptionKeyB64 := getEnv("CHAT_ENCRYPTION_KEY", "")
	encryptionKeyID := getEnv("CHAT_ENCRYPTION_KEY_ID", "v1")

	s3Endpoint := getEnv("S3_ENDPOINT", getEnv("S3_ENDPOINT_URL", "http://rustfs:9000"))
	s3AccessKey := getEnv("S3_ACCESS_KEY", getEnv("S3_ROOT_USER", "minioadmin"))
	s3SecretKey := getEnv("S3_SECRET_KEY", getEnv("S3_ROOT_PASSWORD", "minioadmin"))
	s3BucketName := getEnv("S3_BUCKET_NAME", "alfheim-assets")
	s3UseSSL := getEnvAsBool("S3_USE_SSL", false)
	s3Region := getEnv("S3_REGION", "us-east-1")

	defaultS3PublicURL := "http://api.alfheim.loegien.localhost/storage"
	if baseURL := getEnv("ALFHEIM_BASE_URL", ""); baseURL != "" {
		defaultS3PublicURL = fmt.Sprintf("%s/storage", strings.TrimRight(baseURL, "/"))
	}
	s3PublicURL := getEnv("S3_PUBLIC_URL", defaultS3PublicURL)

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
		OIDC: OIDCConfig{
			IssuerURL: oidcIssuerURL,
			Audience:  oidcAudience,
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
		Storage: StorageConfig{
			Endpoint:   s3Endpoint,
			AccessKey:  s3AccessKey,
			SecretKey:  s3SecretKey,
			BucketName: s3BucketName,
			UseSSL:     s3UseSSL,
			Region:     s3Region,
			PublicURL:  s3PublicURL,
		},
		MCPServersSpec: getEnv("CHAT_MCP_SERVERS", ""),
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

func getEnvAsBool(key string, fallback bool) bool {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return fallback
	}
	val, err := strconv.ParseBool(valueStr)
	if err != nil {
		return fallback
	}
	return val
}
