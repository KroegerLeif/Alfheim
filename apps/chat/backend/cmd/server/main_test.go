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

	"alfheim/chat/config"
	"alfheim/chat/internal/features/mcpservers"
	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/db"
	"alfheim/chat/internal/shared/middleware"
	"alfheim/chat/internal/shared/storage"
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

func TestHealthHandler(t *testing.T) {
	t.Run("nil dbClient returns 503", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/health", nil)
		rec := httptest.NewRecorder()
		handler := healthHandler(nil)
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected status 503, got %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"status":"degraded"`) {
			t.Errorf("expected degraded status, got %s", rec.Body.String())
		}
	})

	t.Run("nil pool returns 503", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/health", nil)
		rec := httptest.NewRecorder()
		handler := healthHandler(&db.Client{Pool: nil})
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected status 503, got %d", rec.Code)
		}
	})
}

func TestBuildRouter(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	dbClient := &db.Client{Pool: nil}

	router := buildRouter(log, dbClient, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", rec.Code)
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

func TestRun_ConfigLoadError(t *testing.T) {
	origConfigLoad := configLoad
	defer func() { configLoad = origConfigLoad }()

	configLoad = func() (*config.Config, error) {
		return nil, errors.New("config load failed")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "config load failed") {
		t.Fatalf("expected config load error, got %v", err)
	}
}

func TestRun_DBConnectionError(t *testing.T) {
	origNewDB := newDBClient
	defer func() { newDBClient = origNewDB }()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return nil, errors.New("db connection failed")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "db connection failed") {
		t.Fatalf("expected db connection error, got %v", err)
	}
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
		return nil, errors.New("auth setup failed")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "auth setup failed") {
		t.Fatalf("expected auth setup error, got %v", err)
	}
}

func TestRun_EnsureBootstrapError(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	origEnsureBootstrap := ensureBootstrap
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
		ensureBootstrap = origEnsureBootstrap
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return &middleware.Authenticator{}, nil
	}
	ensureBootstrap = func(ctx context.Context, s modelblocks.Service, seed modelblocks.BootstrapSeed) error {
		return errors.New("simulated bootstrap error")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "bootstrap model block") {
		t.Fatalf("expected bootstrap error, got %v", err)
	}
}

func TestRun_SeedFromEnvError(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	origSeedMCPServers := seedMCPServers
	origEnsureBootstrap := ensureBootstrap
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
		seedMCPServers = origSeedMCPServers
		ensureBootstrap = origEnsureBootstrap
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return &middleware.Authenticator{}, nil
	}
	ensureBootstrap = func(ctx context.Context, s modelblocks.Service, seed modelblocks.BootstrapSeed) error {
		return nil
	}
	seedMCPServers = func(ctx context.Context, s mcpservers.Service, spec string) error {
		return errors.New("simulated seed mcp error")
	}

	err := run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "seed mcp server registry") {
		t.Fatalf("expected mcp server registry seed error, got %v", err)
	}
}

func TestRun_GracefulShutdown_ContextCancel(t *testing.T) {
	origNewDB := newDBClient
	origSetupAuth := setupAuth
	origConfigLoad := configLoad
	origNewStorage := newStorage
	origDiagnose := diagnoseMCPServers
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
		configLoad = origConfigLoad
		newStorage = origNewStorage
		diagnoseMCPServers = origDiagnose
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return &middleware.Authenticator{}, nil
	}
	newStorage = func(ctx context.Context, cfg config.StorageConfig) (storage.Client, error) {
		return nil, errors.New("storage warning test")
	}
	diagnoseMCPServers = func(ctx context.Context, s mcpservers.Service, pool mcpservers.MCPClientPool) ([]mcpservers.ServerDiagnosticDTO, error) {
		return []mcpservers.ServerDiagnosticDTO{
			{Reachable: true, AppSlug: "pantry", EndpointURL: "http://pantry/mcp", LatencyMs: 10, ToolsCount: 3},
			{Reachable: false, AppSlug: "chores", EndpointURL: "http://chores/mcp", Error: "offline"},
		}, nil
	}

	port := getFreePort(t)
	configLoad = func() (*config.Config, error) {
		cfg, err := config.Load()
		if err != nil {
			return nil, err
		}
		cfg.Port = port
		cfg.Bootstrap.OllamaBaseURL = ""
		cfg.Bootstrap.OllamaModel = ""
		cfg.MCPServersSpec = ""
		return cfg, nil
	}

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
	origConfigLoad := configLoad
	origDiagnose := diagnoseMCPServers
	defer func() {
		newDBClient = origNewDB
		setupAuth = origSetupAuth
		configLoad = origConfigLoad
		diagnoseMCPServers = origDiagnose
	}()

	newDBClient = func(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*db.Client, error) {
		return &db.Client{Pool: nil}, nil
	}
	setupAuth = func(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
		return &middleware.Authenticator{}, nil
	}
	diagnoseMCPServers = func(ctx context.Context, s mcpservers.Service, pool mcpservers.MCPClientPool) ([]mcpservers.ServerDiagnosticDTO, error) {
		return nil, errors.New("diagnostic error test")
	}

	port := getFreePort(t)
	configLoad = func() (*config.Config, error) {
		cfg, err := config.Load()
		if err != nil {
			return nil, err
		}
		cfg.Port = port
		cfg.Bootstrap.OllamaBaseURL = ""
		cfg.Bootstrap.OllamaModel = ""
		cfg.MCPServersSpec = ""
		return cfg, nil
	}

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
	origConfigLoad := configLoad
	defer func() {
		osExit = origExit
		configLoad = origConfigLoad
	}()

	var exitCode int
	osExit = func(code int) {
		exitCode = code
	}
	configLoad = func() (*config.Config, error) {
		return nil, errors.New("simulated main error")
	}

	main()

	if exitCode != 1 {
		t.Errorf("expected exit code 1, got %d", exitCode)
	}
}
