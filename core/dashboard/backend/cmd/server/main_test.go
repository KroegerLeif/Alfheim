package main

import (
	"io"
	"log/slog"
	"testing"

	"alfheim/dashboard/config"
)

func TestSetupAuthenticator_FailClosed(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	cfg := &config.Config{
		Keycloak: config.KeycloakConfig{
			JWKSURL:        "http://invalid.local/jwks-does-not-exist",
			ExpectedIssuer: "http://invalid.local/auth/realms/alfheim",
		},
	}

	auth, err := setupAuthenticator(cfg, log)
	if err == nil {
		t.Errorf("expected error when setting up authenticator with unreachable JWKS URL, got nil")
	}
	if auth != nil {
		t.Errorf("expected nil authenticator when setup fails, got %v", auth)
	}
}
