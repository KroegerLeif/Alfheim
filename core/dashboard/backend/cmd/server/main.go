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
	"alfheim/dashboard/internal/features/apps"
	"alfheim/dashboard/internal/features/contact"
	"alfheim/dashboard/internal/features/household"
	"alfheim/dashboard/internal/features/profile"
	"alfheim/dashboard/internal/features/telemetry"
	"alfheim/dashboard/internal/shared/db"
	"alfheim/dashboard/internal/shared/keycloak"
	"alfheim/dashboard/internal/shared/logger"
	"alfheim/dashboard/internal/shared/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("failed to load application configuration: %v\n", err)
		os.Exit(1)
	}

	log := logger.Init(cfg.Environment)
	log.Info("starting dashboard-backend control plane service",
		slog.String("environment", cfg.Environment),
		slog.String("port", cfg.Port),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Initialize PostgreSQL DB Pool
	dbClient, err := db.NewClient(ctx, cfg.Database, log)
	if err != nil {
		log.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer dbClient.Close()

	// Execute migrations
	if err := dbClient.RunMigrations(cfg.Database.URL, cfg.Database.MigrationsDir); err != nil {
		log.Warn("database schema migration skipped or encountered notice", slog.String("error", err.Error()))
	}

	// Keycloak Admin client & Authenticator
	kcClient := keycloak.NewClient(cfg.Keycloak, log)
	auth, err := setupAuthenticator(cfg, log)
	if err != nil {
		log.Error("failed to initialize oidc jwks authenticator", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Initialize Repositories
	profileRepo := profile.NewRepository(dbClient.Pool)
	householdRepo := household.NewRepository(dbClient.Pool)
	appsRepo := apps.NewRepository(dbClient.Pool)
	contactRepo := contact.NewRepository(dbClient.Pool)

	// Initialize Stack Apps Loader for Tier 2 integrations
	stackLoader := apps.NewStackAppsLoader(cfg.StackAppsPath, log)

	// Initialize Services
	profileService := profile.NewService(profileRepo, kcClient, log)
	householdService := household.NewService(householdRepo, log)
	appsService := apps.NewService(appsRepo, stackLoader, log)
	contactService := contact.NewService(contactRepo, householdRepo, log)
	telemetryService := telemetry.NewService("", log)

	// Initialize Handlers
	profileHandler := profile.NewHandler(profileService)
	householdHandler := household.NewHandler(householdService)
	appsHandler := apps.NewHandler(appsService)
	contactHandler := contact.NewHandler(contactService)
	telemetryHandler := telemetry.NewHandler(telemetryService)

	// Router Setup
	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RequestLogger(log))

	// Health Check Endpoints
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy","service":"dashboard-backend"}`))
	})

	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := dbClient.Pool.Ping(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"unready","database":"disconnected"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready","database":"connected"}`))
	})

	// Auth Middleware enforcing OIDC JWT validation and household role resolution
	roleMw := middleware.HouseholdRoleMiddleware(dbClient.Pool, log)
	authMw := func(next http.Handler) http.Handler {
		return auth.AuthenticateMiddleware(roleMw(next))
	}

	// Register Feature Domain Routes
	profileHandler.RegisterRoutes(r, authMw)
	householdHandler.RegisterRoutes(r, authMw)
	appsHandler.RegisterRoutes(r, authMw)
	contactHandler.RegisterRoutes(r, authMw)
	telemetryHandler.RegisterRoutes(r, authMw)

	// HTTP Server & Graceful Shutdown
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	g, gCtx := errgroup.WithContext(context.Background())

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
		os.Exit(1)
	}

	log.Info("dashboard-backend service stopped cleanly")
}

// setupAuthenticator initializes the OIDC JWT authenticator from application configuration.
func setupAuthenticator(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
	return middleware.NewAuthenticator(cfg.Keycloak.JWKSURL, cfg.Keycloak.ExpectedIssuer, log)
}
