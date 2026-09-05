package config

import (
	"testing"
)

func TestConfigLoad(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cfg.Environment == "" {
		t.Error("expected non-empty environment")
	}
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

