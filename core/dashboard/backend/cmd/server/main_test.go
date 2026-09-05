package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"syscall"
	"testing"
	"time"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/shared/db"
	"alfheim/dashboard/internal/shared/middleware"
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

func getFreePort(t *testing.T) string {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	_, port, err := net.SplitHostPort(l.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	return port
}

func TestRun_AuthenticatorError(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return nil, errors.New("auth init failure")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "auth init failure") {
		t.Errorf("expected auth init failure, got %v", err)
	}
}

func TestRun_GracefulShutdown_ContextCancel(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return nil, nil
	}

	port := getFreePort(t)
	t.Setenv("PORT", port)

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		errCh <- run(ctx)
	}()

	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected clean shutdown, got error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for graceful shutdown")
	}
}

func TestRun_GracefulShutdown_Signal(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return nil, nil
	}

	port := getFreePort(t)
	t.Setenv("PORT", port)

	errCh := make(chan error, 1)
	go func() {
		errCh <- run(context.Background())
	}()

	time.Sleep(50 * time.Millisecond)
	p, err := os.FindProcess(os.Getpid())
	if err != nil {
		t.Fatal(err)
	}
	_ = p.Signal(syscall.SIGINT)

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("expected clean signal shutdown, got error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for signal shutdown")
	}
}

func TestMain_Function(t *testing.T) {
	origExit := osExit
	defer func() { osExit = origExit }()

	var exitCode int
	osExit = func(code int) {
		exitCode = code
	}

	t.Setenv("DATABASE_URL", "postgres://user:pass@127.0.0.1:54321/db?sslmode=disable")
	main()

	if exitCode != 1 {
		t.Errorf("expected exit code 1, got %d", exitCode)
	}
}
