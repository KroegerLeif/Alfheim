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
	t.Setenv("OIDC_ISSUER_URL", "")
	t.Setenv("OIDC_AUDIENCE", "")
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
	if cfg.OIDC.Audience != "alfheim" {
		t.Errorf("expected OIDC Audience alfheim, got %s", cfg.OIDC.Audience)
	}
	if cfg.OIDC.IssuerURL != "http://localhost:8080" {
		t.Errorf("expected default OIDC IssuerURL http://localhost:8080, got %s", cfg.OIDC.IssuerURL)
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
	t.Setenv("OIDC_ISSUER_URL", "https://auth.example.com/")
	t.Setenv("OIDC_AUDIENCE", "custom-audience")
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
	if cfg.OIDC.IssuerURL != "https://auth.example.com" {
		t.Errorf("expected OIDC IssuerURL https://auth.example.com (trailing slash trimmed), got %s", cfg.OIDC.IssuerURL)
	}
	if cfg.OIDC.Audience != "custom-audience" {
		t.Errorf("expected OIDC Audience custom-audience, got %s", cfg.OIDC.Audience)
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
