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
