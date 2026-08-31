package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/shared/db"
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

func TestBuildRouter(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	dbClient := &db.Client{Pool: nil}

	router := buildRouter(log, dbClient, nil, nil, "")

	t.Run("/healthz endpoint returns 200 healthy", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"status":"healthy"`) {
			t.Errorf("expected body to contain healthy status, got %s", rec.Body.String())
		}
	})

	t.Run("/readyz endpoint returns 200 ready when pool is nil", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"status":"ready"`) {
			t.Errorf("expected body to contain ready status, got %s", rec.Body.String())
		}
	})
}

func TestRun_ReturnsErrorOnUnreachableDB(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@127.0.0.1:54321/db?sslmode=disable")
	err := run(t.Context())
	if err == nil {
		t.Fatal("expected error from run when DB is unreachable, got nil")
	}
}
