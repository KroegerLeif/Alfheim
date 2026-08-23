package config

import (
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear potential environment overrides for clean testing of defaults
	t.Setenv("PORT", "")
	t.Setenv("ENVIRONMENT", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_MAX_CONNS", "")
	t.Setenv("DB_MIN_CONNS", "")
	t.Setenv("DB_MAX_CONN_LIFETIME_MINUTES", "")
	t.Setenv("MIGRATIONS_DIR", "")
	t.Setenv("KEYCLOAK_BASE_URL", "")
	t.Setenv("KEYCLOAK_REALM", "")
	t.Setenv("KEYCLOAK_CLIENT_ID", "")
	t.Setenv("KEYCLOAK_CLIENT_SECRET", "")
	t.Setenv("KEYCLOAK_JWKS_URL", "")
	t.Setenv("KEYCLOAK_PUBLIC_ISSUER", "")
	t.Setenv("STACK_APPS_PATH", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error loading default config, got %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("expected Port 8080, got %s", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected Environment development, got %s", cfg.Environment)
	}
	if cfg.Database.MaxConns != 25 {
		t.Errorf("expected MaxConns 25, got %d", cfg.Database.MaxConns)
	}
	if cfg.Database.MinConns != 5 {
		t.Errorf("expected MinConns 5, got %d", cfg.Database.MinConns)
	}
	if cfg.Database.MaxConnLifetime != 30*time.Minute {
		t.Errorf("expected MaxConnLifetime 30m, got %v", cfg.Database.MaxConnLifetime)
	}
	if cfg.Database.MigrationsDir != "migrations" {
		t.Errorf("expected MigrationsDir migrations, got %s", cfg.Database.MigrationsDir)
	}
	if cfg.Keycloak.Realm != "alfheim" {
		t.Errorf("expected Realm alfheim, got %s", cfg.Keycloak.Realm)
	}
	if cfg.StackAppsPath != "deploy/stack-apps.yaml" {
		t.Errorf("expected StackAppsPath deploy/stack-apps.yaml, got %s", cfg.StackAppsPath)
	}
}

func TestLoad_CustomEnv(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/custom_db")
	t.Setenv("DB_MAX_CONNS", "50")
	t.Setenv("DB_MIN_CONNS", "10")
	t.Setenv("DB_MAX_CONN_LIFETIME_MINUTES", "15")
	t.Setenv("MIGRATIONS_DIR", "/custom/migrations")
	t.Setenv("KEYCLOAK_BASE_URL", "http://auth.example.com")
	t.Setenv("KEYCLOAK_REALM", "custom-realm")
	t.Setenv("KEYCLOAK_CLIENT_ID", "custom-client")
	t.Setenv("KEYCLOAK_CLIENT_SECRET", "secret-key")
	t.Setenv("KEYCLOAK_JWKS_URL", "http://auth.example.com/certs")
	t.Setenv("KEYCLOAK_PUBLIC_ISSUER", "http://auth.example.com/issuer")
	t.Setenv("STACK_APPS_PATH", "/custom/stack-apps.yaml")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error loading custom config, got %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("expected Port 9090, got %s", cfg.Port)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected Environment production, got %s", cfg.Environment)
	}
	if cfg.Database.URL != "postgres://user:pass@localhost:5432/custom_db" {
		t.Errorf("expected Database URL postgres://user:pass@localhost:5432/custom_db, got %s", cfg.Database.URL)
	}
	if cfg.Database.MaxConns != 50 {
		t.Errorf("expected MaxConns 50, got %d", cfg.Database.MaxConns)
	}
	if cfg.Database.MinConns != 10 {
		t.Errorf("expected MinConns 10, got %d", cfg.Database.MinConns)
	}
	if cfg.Database.MaxConnLifetime != 15*time.Minute {
		t.Errorf("expected MaxConnLifetime 15m, got %v", cfg.Database.MaxConnLifetime)
	}
	if cfg.Database.MigrationsDir != "/custom/migrations" {
		t.Errorf("expected MigrationsDir /custom/migrations, got %s", cfg.Database.MigrationsDir)
	}
	if cfg.Keycloak.ClientID != "custom-client" {
		t.Errorf("expected ClientID custom-client, got %s", cfg.Keycloak.ClientID)
	}
	if cfg.Keycloak.ClientSecret != "secret-key" {
		t.Errorf("expected ClientSecret secret-key, got %s", cfg.Keycloak.ClientSecret)
	}
	if cfg.Keycloak.JWKSURL != "http://auth.example.com/certs" {
		t.Errorf("expected JWKSURL http://auth.example.com/certs, got %s", cfg.Keycloak.JWKSURL)
	}
	if cfg.Keycloak.ExpectedIssuer != "http://auth.example.com/issuer" {
		t.Errorf("expected ExpectedIssuer http://auth.example.com/issuer, got %s", cfg.Keycloak.ExpectedIssuer)
	}
	if cfg.StackAppsPath != "/custom/stack-apps.yaml" {
		t.Errorf("expected StackAppsPath /custom/stack-apps.yaml, got %s", cfg.StackAppsPath)
	}
}

func TestLoad_InvalidIntConversion(t *testing.T) {
	t.Setenv("DB_MAX_CONNS", "invalid_number")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error loading config with invalid int, got %v", err)
	}

	// Should fall back to default value of 25
	if cfg.Database.MaxConns != 25 {
		t.Errorf("expected fallback MaxConns 25 for invalid int input, got %d", cfg.Database.MaxConns)
	}
}
