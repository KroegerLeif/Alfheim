package config

import (
	"bytes"
	"testing"
	"time"
)

func TestConfigLoad(t *testing.T) {
	t.Run("fails without ALFHEIM_INTERNAL_TOKEN", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "")
		if _, err := Load(); err == nil {
			t.Fatal("expected error when ALFHEIM_INTERNAL_TOKEN is missing")
		}
	})

	t.Run("household internal api settings", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("HOUSEHOLD_INTERNAL_URL", "")
		cfg, err := Load()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if cfg.Household.InternalURL != "http://household-backend:8080" || cfg.Household.InternalToken != "secret" {
			t.Errorf("unexpected household config %+v", cfg.Household)
		}
		t.Setenv("HOUSEHOLD_INTERNAL_URL", "http://hh.internal:9000/")
		cfg, err = Load()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if cfg.Household.InternalURL != "http://hh.internal:9000" {
			t.Errorf("expected trimmed custom url, got %q", cfg.Household.InternalURL)
		}
	})

	t.Run("default configuration", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("OIDC_ISSUER_URL", "")
		t.Setenv("OIDC_AUDIENCE", "")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if cfg.Environment == "" {
			t.Error("expected non-empty environment")
		}
		if cfg.OIDC.IssuerURL != "http://localhost:8080" {
			t.Errorf("expected default OIDC IssuerURL http://localhost:8080, got %s", cfg.OIDC.IssuerURL)
		}
		if cfg.OIDC.Audience != "alfheim" {
			t.Errorf("expected default OIDC Audience alfheim, got %s", cfg.OIDC.Audience)
		}
	})

	t.Run("custom OIDC environment variables", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("OIDC_ISSUER_URL", "https://auth.example.com/")
		t.Setenv("OIDC_AUDIENCE", "custom-audience")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if cfg.OIDC.IssuerURL != "https://auth.example.com" {
			t.Errorf("expected OIDC IssuerURL https://auth.example.com (trailing slash trimmed), got %s", cfg.OIDC.IssuerURL)
		}
		if cfg.OIDC.Audience != "custom-audience" {
			t.Errorf("expected OIDC Audience custom-audience, got %s", cfg.OIDC.Audience)
		}
	})
}

func TestHelpers(t *testing.T) {
	t.Run("getEnv", func(t *testing.T) {
		t.Setenv("TEST_KEY", "val")
		if getEnv("TEST_KEY", "fallback") != "val" {
			t.Error("expected val")
		}
		if getEnv("NONEXISTENT_KEY", "fallback") != "fallback" {
			t.Error("expected fallback")
		}
	})

	t.Run("getEnvAsInt32", func(t *testing.T) {
		t.Setenv("VALID_INT", "42")
		t.Setenv("INVALID_INT", "not-int")
		if getEnvAsInt32("VALID_INT", 10) != 42 {
			t.Error("expected 42")
		}
		if getEnvAsInt32("INVALID_INT", 10) != 10 {
			t.Error("expected fallback 10")
		}
		if getEnvAsInt32("EMPTY_INT", 10) != 10 {
			t.Error("expected fallback 10")
		}
	})

	t.Run("getEnvAsBool", func(t *testing.T) {
		t.Setenv("VALID_BOOL", "true")
		t.Setenv("INVALID_BOOL", "not-bool")
		if !getEnvAsBool("VALID_BOOL", false) {
			t.Error("expected true")
		}
		if getEnvAsBool("INVALID_BOOL", true) != true {
			t.Error("expected fallback true")
		}
		if getEnvAsBool("EMPTY_BOOL", false) != false {
			t.Error("expected fallback false")
		}
	})
}

func TestAttachmentURLSecretConfig(t *testing.T) {
	strong := "0123456789abcdef0123456789abcdef"

	t.Run("production refuses to start without the secret", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("ENVIRONMENT", "production")
		t.Setenv("CHAT_ATTACHMENT_URL_SECRET", "")
		if _, err := Load(); err == nil {
			t.Fatal("expected an error when CHAT_ATTACHMENT_URL_SECRET is missing in production")
		}
	})

	t.Run("a short secret is rejected in every environment", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("ENVIRONMENT", "development")
		t.Setenv("CHAT_ATTACHMENT_URL_SECRET", "too-short")
		if _, err := Load(); err == nil {
			t.Fatal("expected an error for a secret shorter than 32 bytes")
		}
	})

	t.Run("a configured secret is used with the default ttl and trimmed base url", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("ENVIRONMENT", "production")
		t.Setenv("CHAT_ATTACHMENT_URL_SECRET", strong)
		t.Setenv("ALFHEIM_BASE_URL", "https://alfheim.example/")
		cfg, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(cfg.Attachments.URLSecret) != strong {
			t.Error("the configured secret must be used verbatim")
		}
		if cfg.Attachments.URLTTL != 15*time.Minute {
			t.Errorf("ttl = %v, want 15m", cfg.Attachments.URLTTL)
		}
		if cfg.Attachments.PublicBaseURL != "https://alfheim.example" {
			t.Errorf("base url = %q", cfg.Attachments.PublicBaseURL)
		}
	})

	t.Run("development without a secret gets a random per-process key", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("ENVIRONMENT", "development")
		t.Setenv("CHAT_ATTACHMENT_URL_SECRET", "")
		first, err := Load()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		second, _ := Load()
		if len(first.Attachments.URLSecret) < MinAttachmentURLSecretBytes {
			t.Fatalf("ephemeral secret has %d bytes", len(first.Attachments.URLSecret))
		}
		if bytes.Equal(first.Attachments.URLSecret, second.Attachments.URLSecret) {
			t.Error("ephemeral secrets must not repeat")
		}
	})

	t.Run("a non-positive ttl is rejected", func(t *testing.T) {
		t.Setenv("ALFHEIM_INTERNAL_TOKEN", "secret")
		t.Setenv("CHAT_ATTACHMENT_URL_SECRET", strong)
		t.Setenv("CHAT_ATTACHMENT_URL_TTL_MINUTES", "0")
		if _, err := Load(); err == nil {
			t.Fatal("expected an error for a zero ttl")
		}
	})
}
