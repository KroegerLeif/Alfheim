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
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"alfheim/go-shared/auth"
	"alfheim/go-shared/db"
	"alfheim/household/config"
	"alfheim/household/internal/features/servicebindings"
)

func TestSetupAuthenticator_FailClosed(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	cfg := &config.Config{
		OIDC: config.OIDCConfig{
			IssuerURL: "http://invalid.local",
			Audience:  "alfheim",
		},
	}

	authenticator, err := setupAuthenticator(t.Context(), cfg, log)
	if err == nil {
		t.Errorf("expected error when setting up authenticator with unreachable JWKS URL, got nil")
	}
	if authenticator != nil {
		t.Errorf("expected nil authenticator when setup fails, got %v", authenticator)
	}
}

func passthroughAuth(next http.Handler) http.Handler { return next }

func TestBuildRouter_PanicsWithoutAuth(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	defer func() {
		if recover() == nil {
			t.Fatal("expected buildRouter to panic when auth middleware is nil")
		}
	}()
	buildRouter(log, &db.Client{Pool: nil}, nil, routerConfig{})
}

func TestBuildRouter(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	dbClient := &db.Client{Pool: nil}

	router := buildRouter(log, dbClient, nil, routerConfig{authMw: passthroughAuth, internalToken: "test-token"})

	t.Run("internal membership API is mounted without JWT and requires the internal token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/internal/v1/memberships/0b9f6c2e-4f5a-4c1d-9e0a-6a1c2b3d4e5f/user-1", nil)
		req.Header.Set("Authorization", "Bearer wrong")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("CORS preflight allows PATCH", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/households/x", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if !strings.Contains(rec.Header().Get("Access-Control-Allow-Methods"), "PATCH") {
			t.Errorf("expected PATCH in allowed methods, got %q", rec.Header().Get("Access-Control-Allow-Methods"))
		}
	})

	t.Run("a router without a readiness check is never ready", func(t *testing.T) {
		if got := probeStatus(t, router, "/readyz"); got != http.StatusServiceUnavailable {
			t.Errorf("/readyz = %d, want 503", got)
		}
	})
}

// TestBuildRouter_RejectsServicePrincipals covers #958: a configured service
// principal is refused on the public API before any handler runs.
func TestBuildRouter_RejectsServicePrincipals(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	asPrincipal := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), auth.UserContextKey, &auth.UserClaims{Subject: "integrations"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
	router := buildRouter(log, &db.Client{}, nil, routerConfig{
		authMw:     asPrincipal,
		principals: servicebindings.NewPrincipals([]string{"integrations"}),
	})
	for _, path := range []string{"/api/v1/households/me", "/api/v1/profile/me", "/api/v1/households/" + "0b9f6c2e-4f5a-4c1d-9e0a-6a1c2b3d4e5f/service-bindings"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s: expected 403, got %d", path, rec.Code)
		}
	}
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
	setupAuth = func(_ context.Context, cfg *config.Config, log *slog.Logger) (*auth.Authenticator, error) {
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
	setupAuth = func(_ context.Context, cfg *config.Config, log *slog.Logger) (*auth.Authenticator, error) {
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
	setupAuth = func(_ context.Context, cfg *config.Config, log *slog.Logger) (*auth.Authenticator, error) {
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

// probeStatus returns the status router answers path with.
func probeStatus(t *testing.T, router http.Handler, path string) int {
	t.Helper()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Code
}

func TestBuildRouter_Probes(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	up := func(context.Context) error { return nil }
	down := func(context.Context) error { return errors.New("connection refused") }

	healthy := buildRouter(log, &db.Client{}, up, routerConfig{authMw: passthroughAuth, internalToken: "test-token"})
	if got := probeStatus(t, healthy, "/healthz"); got != http.StatusOK {
		t.Errorf("/healthz = %d, want 200", got)
	}
	if got := probeStatus(t, healthy, "/readyz"); got != http.StatusOK {
		t.Errorf("/readyz with a reachable database = %d, want 200", got)
	}

	degraded := buildRouter(log, &db.Client{}, down, routerConfig{authMw: passthroughAuth, internalToken: "test-token"})
	if got := probeStatus(t, degraded, "/healthz"); got != http.StatusOK {
		t.Errorf("/healthz with the database down = %d, want 200 (liveness ignores it)", got)
	}
	if got := probeStatus(t, degraded, "/readyz"); got != http.StatusServiceUnavailable {
		t.Errorf("/readyz with the database down = %d, want 503", got)
	}
}

func TestReadinessCheck_UnreadableMigrationsStaysUnready(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	check := readinessCheck(&db.Client{}, filepath.Join(t.TempDir(), "missing"), log)
	if err := check(context.Background()); err == nil {
		t.Error("a missing migrations directory must keep the backend unready")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "000001_init.up.sql"), []byte("SELECT 1;"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := readinessCheck(&db.Client{}, dir, log)(context.Background()); err == nil {
		t.Error("a client without a pool must not be ready")
	}
}

func TestSignupOptions(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	t.Setenv("ALFHEIM_EXTRA_CA_FILE", "")
	t.Setenv("ALFHEIM_SIGNUP_ALLOWLIST", "")
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	if opts, err := signupOptions(cfg, log); err != nil || len(opts) != 0 {
		t.Errorf("no allowlist: %v %v", opts, err)
	}

	t.Setenv("ALFHEIM_SIGNUP_ALLOWLIST", "@family.example")
	if cfg, err = config.Load(); err != nil {
		t.Fatal(err)
	}
	if opts, err := signupOptions(cfg, log); err != nil || len(opts) != 1 {
		t.Errorf("allowlist set: %v %v", opts, err)
	}

	t.Setenv("ALFHEIM_EXTRA_CA_FILE", filepath.Join(t.TempDir(), "missing.pem"))
	if _, err := signupOptions(cfg, log); err == nil {
		t.Error("an unreadable extra CA file must fail")
	}
}
