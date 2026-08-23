// Package main is the entry point for the alfheim chat-backend service.
package main

import (
	"context"
	"encoding/json"
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

	"alfheim/chat/config"
	"alfheim/chat/internal/shared/db"
	"alfheim/chat/internal/shared/logger"
	"alfheim/chat/internal/shared/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("failed to load application configuration: %v\n", err)
		os.Exit(1)
	}

	log := logger.Init(cfg.Environment)
	log.Info("starting chat-backend service",
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

	// OIDC JWT Authenticator (validates issuer AND audience against Keycloak JWKS).
	if _, err := setupAuthenticator(cfg, log); err != nil {
		log.Error("failed to initialize oidc jwks authenticator", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Router Setup
	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RequestLogger(log))

	// Health Check Endpoint (unauthenticated, mirrors the compose healthcheck path
	// used by the other FastAPI backends: /api/v1/health, scoped here under /chat).
	r.Get("/api/v1/chat/health", healthHandler(dbClient))

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

	log.Info("chat-backend service stopped cleanly")
}

// setupAuthenticator initializes the OIDC JWT authenticator from application configuration.
func setupAuthenticator(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
	return middleware.NewAuthenticator(cfg.Keycloak.JWKSURL, cfg.Keycloak.ExpectedIssuer, cfg.Keycloak.ExpectedAudience, log)
}

// healthHandler reports service and database connectivity status for compose healthchecks.
func healthHandler(dbClient *db.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if err := dbClient.Pool.Ping(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"status":   "degraded",
				"service":  "chat-backend",
				"database": "disconnected",
			})
			return
		}

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":   "ok",
			"service":  "chat-backend",
			"database": "connected",
		})
	}
}
