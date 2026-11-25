// Package main is the entry point for the alfheim dashboard-backend service.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"golang.org/x/sync/errgroup"

	"alfheim/dashboard/config"
	"alfheim/dashboard/internal/features/apphealth"
	"alfheim/dashboard/internal/features/apps"
	"alfheim/dashboard/internal/features/capabilities"
	"alfheim/dashboard/internal/features/launchers"
	"alfheim/dashboard/internal/features/plugins"
	"alfheim/dashboard/internal/features/telemetry"
	"alfheim/dashboard/internal/shared/middleware"
	"alfheim/go-shared/auth"
	"alfheim/go-shared/db"
	"alfheim/go-shared/health"
	"alfheim/go-shared/household"
	"alfheim/go-shared/httpmw"
	"alfheim/go-shared/logger"
)

var (
	osExit      = os.Exit
	newDBClient = db.NewClient
	setupAuth   = setupAuthenticator
)

func main() {
	if err := run(context.Background()); err != nil {
		fmt.Printf("application stopped with error: %v\n", err)
		osExit(1)
	}
}

func run(parentCtx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load application configuration: %w", err)
	}

	log := logger.Init(cfg.Environment)
	log.Info("starting dashboard-backend control plane service",
		slog.String("environment", cfg.Environment),
		slog.String("port", cfg.Port),
	)

	ctx, cancel := context.WithTimeout(parentCtx, 30*time.Second)
	defer cancel()

	// Initialize PostgreSQL DB Pool
	dbClient, err := newDBClient(ctx, cfg.Database, log)
	if err != nil {
		log.Error("failed to connect to database", slog.String("error", err.Error()))
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer dbClient.Close()

	// Execute migrations
	if err := dbClient.RunMigrations(cfg.Database.URL, cfg.Database.MigrationsDir); err != nil {
		log.Warn("database schema migration skipped or encountered notice", slog.String("error", err.Error()))
	}

	// Generic OIDC Bearer token authenticator (JWKS discovered from the issuer)
	authenticator, err := setupAuth(ctx, cfg, log)
	if err != nil {
		log.Error("failed to initialize oidc jwks authenticator", slog.String("error", err.Error()))
		return fmt.Errorf("failed to initialize authenticator: %w", err)
	}
	defer authenticator.Close()

	enabledApps := apps.ParseEnabledApps(cfg.EnabledApps)
	ready := readinessCheck(dbClient, cfg.Database.MigrationsDir, log)
	// Household-scoped routes (launchers, plugins) confirm X-Household-ID against
	// core/household's membership API; the JWT never carries a household.
	membership := household.New(cfg.Household.InternalURL, cfg.Household.InternalToken)
	pluginSvc, err := newPluginService(dbClient.Pool, cfg.Integrations, log)
	if err != nil {
		return fmt.Errorf("failed to initialize the plugin framework: %w", err)
	}
	r := buildRouter(log, dbClient, ready, authenticator.AuthenticateMiddleware, membership, pluginSvc, cfg.StackAppsPath, cfg.CORS.AllowedOrigins, enabledApps)

	// HTTP Server & Graceful Shutdown
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	g, gCtx := errgroup.WithContext(parentCtx)

	g.Go(func() error {
		log.Info("http server listening", slog.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("http server error: %w", err)
		}
		return nil
	})

	// Interrupt listener
	g.Go(func() error {
		shutdownSignal := make(chan os.Signal, 1)
		signal.Notify(shutdownSignal, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

		select {
		case <-gCtx.Done():
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()
			_ = srv.Shutdown(shutdownCtx)
			return gCtx.Err()
		case sig := <-shutdownSignal:
			log.Info("received shutdown signal, initiating graceful stop", slog.String("signal", sig.String()))

			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer shutdownCancel()

			if err := srv.Shutdown(shutdownCtx); err != nil {
				return fmt.Errorf("server graceful shutdown failed: %w", err)
			}
			log.Info("server shutdown complete")
			return nil
		}
	})

	if err := g.Wait(); err != nil && !errors.Is(err, context.Canceled) {
		log.Error("application stopped with error", slog.String("error", err.Error()))
		return err
	}

	log.Info("dashboard-backend service stopped cleanly")
	return nil
}

// setupAuthenticator initializes the generic OIDC JWT authenticator from application configuration.
func setupAuthenticator(ctx context.Context, cfg *config.Config, log *slog.Logger) (*auth.Authenticator, error) {
	return auth.NewAuthenticator(ctx, auth.Config{
		IssuerURL: cfg.OIDC.IssuerURL,
		Audience:  cfg.OIDC.Audience,
		Logger:    log,
	})
}

// buildRouter constructs and configures the chi Router with all middlewares and feature endpoints.
// enabledApps is the installation's ALFHEIM_ENABLED_APPS set; it decides which Tier-1 tiles exist.
// membership confirms the household of household-scoped routes; pluginSvc
// serves the typed plugin API.
func buildRouter(log *slog.Logger, dbClient *db.Client, ready health.Check, jwtMw func(http.Handler) http.Handler, membership household.Checker, pluginSvc *plugins.Service, stackAppsPath string, allowedOrigins []string, enabledApps apps.EnabledApps) http.Handler {
	// An unauthenticated API must never be served: refuse to build the router.
	if jwtMw == nil {
		panic("dashboard-backend: auth middleware is required to build the router")
	}

	// Initialize Repositories
	var pool = dbClient.Pool
	appsRepo := apps.NewRepository(pool)

	// Initialize Stack Apps Loader for Tier 2 integrations
	stackLoader := apps.NewStackAppsLoader(stackAppsPath, log)

	// Initialize Services
	coreApps := apps.EnabledCoreApps(enabledApps)
	appsService := apps.NewService(appsRepo, stackLoader, coreApps, log)
	healthService := apphealth.NewService(healthTargets(coreApps), apphealth.NewHTTPProber(nil, apphealth.DefaultProbeTimeout), apphealth.DefaultCacheTTL, log)
	telemetryService := telemetry.NewService("", log)

	launchersService := launchers.NewService(launchers.NewRepository(pool))

	// Initialize Handlers
	appsHandler := apps.NewHandler(appsService)
	launchersHandler := launchers.NewHandler(launchersService, log)
	pluginsHandler := plugins.NewHandler(pluginSvc, log)
	healthHandler := apphealth.NewHandler(healthService)
	telemetryHandler := telemetry.NewHandler(telemetryService)
	capabilitiesHandler := capabilities.NewHandler()
	enabledAppsHandler := apps.NewEnabledAppsHandler(coreApps)

	// Router Setup
	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(httpmw.CORSWithOrigins(httpmw.CORSConfig{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type", "X-Household-ID", "X-Household-Role"},
	}))
	r.Use(httpmw.RequestLogger(log))
	r.Use(httpmw.MaxBodySize(httpmw.DefaultMaxBodyBytes, nil))

	// Liveness (/healthz) and database-aware readiness (/readyz) probes.
	health.Register(r, "dashboard-backend", ready, log)

	// Auth middleware: OIDC JWT validation, then JIT provisioning of the local
	// user_profiles row that user_preferences and user_links reference.
	// Households, roles, profiles and contacts live in core/household. Only the
	// household-scoped launcher and plugin routes read X-Household-ID, and they confirm it
	// against the membership API; X-Household-Role is always ignored.
	profileMw := func(next http.Handler) http.Handler { return next }
	if pool != nil {
		profileMw = middleware.EnsureUserProfile(pool, log)
	}
	authMw := func(next http.Handler) http.Handler {
		return jwtMw(profileMw(next))
	}

	// Register Feature Domain Routes
	appsHandler.RegisterRoutes(r, authMw)
	healthHandler.RegisterRoutes(r, authMw)
	telemetryHandler.RegisterRoutes(r, authMw)
	capabilitiesHandler.RegisterRoutes(r, authMw)
	enabledAppsHandler.RegisterRoutes(r, authMw)
	householdMw := household.RequireHousehold(membership, log)
	launchersHandler.RegisterRoutes(r, authMw, householdMw)
	pluginsHandler.RegisterRoutes(r, authMw, householdMw)

	return r
}

// healthTargets turns the enabled Tier-1 tiles into probe targets, so the
// dashboard never probes an app that is switched off.
func healthTargets(coreApps []apps.AppItem) []apphealth.Target {
	targets := make([]apphealth.Target, 0, len(coreApps))
	for _, app := range coreApps {
		if url, ok := apps.HealthURL(app.ID); ok {
			targets = append(targets, apphealth.Target{ID: app.ID, URL: url})
		}
	}
	return targets
}

// readinessCheck builds the /readyz check: the database must answer and its
// schema must be at the newest migration shipped in migrationsDir. An
// unreadable migrations directory keeps the backend unready instead of
// crash-looping it, and is logged once here.
func readinessCheck(dbClient *db.Client, migrationsDir string, log *slog.Logger) health.Check {
	check, err := dbClient.ReadinessCheck(migrationsDir)
	if err != nil {
		log.Error("readiness check disabled: cannot read the migrations", slog.String("error", err.Error()))
		return func(context.Context) error { return err }
	}
	return check
}
