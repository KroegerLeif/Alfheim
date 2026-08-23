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
	"alfheim/chat/internal/features/attachments"
	"alfheim/chat/internal/features/conversations"
	"alfheim/chat/internal/features/mcpservers"
	"alfheim/chat/internal/features/modelblocks"
	"alfheim/chat/internal/shared/db"
	"alfheim/chat/internal/shared/logger"
	"alfheim/chat/internal/shared/mcp"
	"alfheim/chat/internal/shared/middleware"
	"alfheim/chat/internal/shared/storage"
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
	auth, err := setupAuthenticator(cfg, log)
	if err != nil {
		log.Error("failed to initialize oidc jwks authenticator", slog.String("error", err.Error()))
		os.Exit(1)
	}
	authMw := auth.AuthenticateMiddleware

	// Model Blocks Feature (LLM provider configs, encryption, health checks)
	modelBlocksRepo := modelblocks.NewRepository(dbClient.Pool)
	modelBlocksService := modelblocks.NewService(modelBlocksRepo, cfg.Encryption.Key, cfg.Encryption.KeyID, log)
	modelBlocksHandler := modelblocks.NewHandler(modelBlocksService)

	// Seed the ENV-configured fallback model block on first startup only.
	if err := modelBlocksService.EnsureBootstrap(ctx, modelblocks.BootstrapSeed{
		Provider:      cfg.Bootstrap.Provider,
		OllamaBaseURL: cfg.Bootstrap.OllamaBaseURL,
		OllamaModel:   cfg.Bootstrap.OllamaModel,
		APIKey:        cfg.Bootstrap.APIKey,
	}); err != nil {
		log.Error("failed to seed bootstrap model block", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// MCP Servers Registry (bridges to the Fach-Apps' FastMCP servers)
	mcpServersRepo := mcpservers.NewRepository(dbClient.Pool)
	mcpServersService := mcpservers.NewService(mcpServersRepo, log)
	mcpServersHandler := mcpservers.NewHandler(mcpServersService)
	mcpClientPool := mcp.NewClientPool()

	if err := mcpServersService.SeedFromEnv(ctx, cfg.MCPServersSpec); err != nil {
		log.Error("failed to seed mcp server registry from CHAT_MCP_SERVERS", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// S3 / RustFS Storage Client
	storageClient, err := storage.NewClient(ctx, cfg.Storage)
	if err != nil {
		log.Warn("failed to initialize storage client; attachments may be unavailable", slog.String("error", err.Error()))
	}

	// Attachments Feature (RustFS/S3 file uploads, image references)
	attachmentsRepo := attachments.NewRepository(dbClient.Pool)
	attachmentsService := attachments.NewService(attachmentsRepo, storageClient, log)
	attachmentsHandler := attachments.NewHandler(attachmentsService)

	if err := attachmentsService.EnsureStorageReady(ctx); err != nil {
		log.Warn("s3 bucket check failed or deferred", slog.String("error", err.Error()))
	}

	// Conversations Feature (messages, SSE-streamed assistant replies, MCP tool-calling loop)
	conversationsRepo := conversations.NewRepository(dbClient.Pool, storageClient)
	conversationsService := conversations.NewService(conversationsRepo, modelBlocksService, mcpServersService, mcpClientPool, log)
	conversationsHandler := conversations.NewHandler(conversationsService)

	// Router Setup
	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RequestLogger(log))

	// Health Check Endpoint (unauthenticated, mirrors the compose healthcheck path
	// used by the other FastAPI backends: /api/v1/health, scoped here under /chat).
	r.Get("/api/v1/chat/health", healthHandler(dbClient))

	// Feature Domain Routes
	modelBlocksHandler.RegisterRoutes(r, authMw)
	conversationsHandler.RegisterRoutes(r, authMw)
	mcpServersHandler.RegisterRoutes(r, authMw)
	attachmentsHandler.RegisterRoutes(r, authMw)


	// HTTP Server & Graceful Shutdown.
	// WriteTimeout is generous because the SSE streaming endpoint holds the response
	// open for as long as the model takes to finish generating; ReadTimeout stays
	// short since it only bounds reading the (small) request body/headers.
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 10 * time.Minute,
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
