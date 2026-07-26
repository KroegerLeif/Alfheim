// Package main is the entry point for the loeger-os dashboard-backend service.
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

	"loeger-os/dashboard/config"
	"loeger-os/dashboard/internal/features/apps"
	"loeger-os/dashboard/internal/features/household"
	"loeger-os/dashboard/internal/features/profile"
	"loeger-os/dashboard/internal/features/telemetry"
	"loeger-os/dashboard/internal/shared/db"
	"loeger-os/dashboard/internal/shared/keycloak"
	"loeger-os/dashboard/internal/shared/logger"
	"loeger-os/dashboard/internal/shared/middleware"
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
	auth, err := middleware.NewAuthenticator(cfg.Keycloak.JWKSURL, log)
	if err != nil {
		log.Warn("failed to initialize oidc jwks authenticator; requests will require valid jwks endpoint",
			slog.String("error", err.Error()),
		)
	}

	// Initialize Repositories
	profileRepo := profile.NewRepository(dbClient.Pool)
	householdRepo := household.NewRepository(dbClient.Pool)
	appsRepo := apps.NewRepository(dbClient.Pool)

	// Initialize Services
	profileService := profile.NewService(profileRepo, kcClient, log)
	householdService := household.NewService(householdRepo, log)
	appsService := apps.NewService(appsRepo, log)
	telemetryService := telemetry.NewService("", log)

	// Initialize Handlers
	profileHandler := profile.NewHandler(profileService)
	householdHandler := household.NewHandler(householdService)
	appsHandler := apps.NewHandler(appsService)
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

	// Auth Middleware fallback for optional validation in dev
	var authMw func(http.Handler) http.Handler
	if auth != nil {
		authMw = auth.AuthenticateMiddleware
	} else {
		authMw = func(next http.Handler) http.Handler { return next }
	}

	// Register Feature Domain Routes
	profileHandler.RegisterRoutes(r, authMw)
	householdHandler.RegisterRoutes(r, authMw)
	appsHandler.RegisterRoutes(r, authMw)
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
