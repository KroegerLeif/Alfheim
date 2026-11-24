package config

import (
	"os"
	"strings"
	"testing"
	"time"
)

// TestMain supplies the required ALFHEIM_INTERNAL_TOKEN so the Load tests get
// past the startup check; TestLoad_Household covers the check itself.
func TestMain(m *testing.M) {
	if os.Getenv("ALFHEIM_INTERNAL_TOKEN") == "" {
		_ = os.Setenv("ALFHEIM_INTERNAL_TOKEN", "test-internal-token")
	}
	os.Exit(m.Run())
}

func TestLoad_Household(t *testing.T) {
	t.Setenv("HOUSEHOLD_INTERNAL_URL", "http://household.internal:9000/")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Household.InternalURL != "http://household.internal:9000" || cfg.Household.InternalToken == "" {
		t.Errorf("unexpected household config %+v", cfg.Household)
	}

	t.Setenv("HOUSEHOLD_INTERNAL_URL", "")
	if cfg, err = Load(); err != nil || cfg.Household.InternalURL != "http://household-backend:8080" {
		t.Errorf("default household URL: cfg=%+v err=%v", cfg, err)
	}

	t.Setenv("ALFHEIM_INTERNAL_TOKEN", "  ")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "ALFHEIM_INTERNAL_TOKEN") {
		t.Errorf("a blank ALFHEIM_INTERNAL_TOKEN must fail startup, got %v", err)
	}
}

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

func TestLoad_EnabledApps(t *testing.T) {
	t.Run("unset means every app", func(t *testing.T) {
		t.Setenv("ALFHEIM_ENABLED_APPS", "")
		if err := os.Unsetenv("ALFHEIM_ENABLED_APPS"); err != nil {
			t.Fatal(err)
		}
		cfg, err := Load()
		if err != nil {
			t.Fatal(err)
		}
		if cfg.EnabledApps != "all" {
			t.Errorf("EnabledApps = %q, want all", cfg.EnabledApps)
		}
	})
	t.Run("empty is kept as the Lean Core", func(t *testing.T) {
		t.Setenv("ALFHEIM_ENABLED_APPS", "")
		cfg, err := Load()
		if err != nil {
			t.Fatal(err)
		}
		if cfg.EnabledApps != "" {
			t.Errorf("EnabledApps = %q, want empty", cfg.EnabledApps)
		}
	})
	t.Run("list is passed through", func(t *testing.T) {
		t.Setenv("ALFHEIM_ENABLED_APPS", "pantry,chat")
		cfg, err := Load()
		if err != nil {
			t.Fatal(err)
		}
		if cfg.EnabledApps != "pantry,chat" {
			t.Errorf("EnabledApps = %q", cfg.EnabledApps)
		}
	})
}

// TestLoad_CORSOrigins covers #921: production never falls back to the dev
// hosts, operator origins are used as configured and a malformed list fails
// startup.
func TestLoad_CORSOrigins(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "") // registers the restore
	if err := os.Unsetenv("CORS_ALLOWED_ORIGINS"); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 0 {
		t.Errorf("production without CORS_ALLOWED_ORIGINS allows %v, want none", cfg.CORS.AllowedOrigins)
	}

	t.Setenv("CORS_ALLOWED_ORIGINS", "https://alfheim.example.com")
	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 1 || cfg.CORS.AllowedOrigins[0] != "https://alfheim.example.com" {
		t.Errorf("AllowedOrigins = %v", cfg.CORS.AllowedOrigins)
	}

	t.Setenv("CORS_ALLOWED_ORIGINS", "*")
	if _, err := Load(); err == nil {
		t.Error("a wildcard origin must fail Load()")
	}
}
