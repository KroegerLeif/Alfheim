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

var (
	osExit          = os.Exit
	configLoad      = config.Load
	newDBClient     = db.NewClient
	setupAuth       = setupAuthenticator
	newStorage      = storage.NewClient
	ensureBootstrap = func(ctx context.Context, s modelblocks.Service, seed modelblocks.BootstrapSeed) error {
		return s.EnsureBootstrap(ctx, seed)
	}
	seedMCPServers = func(ctx context.Context, s mcpservers.Service, spec string) error {
		return s.SeedFromEnv(ctx, spec)
	}
	diagnoseMCPServers = func(ctx context.Context, s mcpservers.Service, pool mcpservers.MCPClientPool) ([]mcpservers.ServerDiagnosticDTO, error) {
		return s.DiagnoseServers(ctx, pool)
	}
)

func main() {
	if err := run(context.Background()); err != nil {
		fmt.Printf("application stopped with error: %v\n", err)
		osExit(1)
	}
}

func run(parentCtx context.Context) error {
	cfg, err := configLoad()
	if err != nil {
		return fmt.Errorf("failed to load application configuration: %w", err)
	}

	log := logger.Init(cfg.Environment)
	log.Info("starting chat-backend service",
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

	// OIDC JWT Authenticator (validates issuer AND audience against Keycloak JWKS).
	auth, err := setupAuth(cfg, log)
	if err != nil {
		log.Error("failed to initialize oidc jwks authenticator", slog.String("error", err.Error()))
		return fmt.Errorf("failed to initialize authenticator: %w", err)
	}
	authMw := auth.AuthenticateMiddleware

	// Model Blocks Feature (LLM provider configs, encryption, health checks)
	modelBlocksRepo := modelblocks.NewRepository(dbClient.Pool)
	modelBlocksService := modelblocks.NewService(modelBlocksRepo, cfg.Encryption.Key, cfg.Encryption.KeyID, log)
	modelBlocksHandler := modelblocks.NewHandler(modelBlocksService)

	// Seed the ENV-configured fallback model block on first startup only.
	if err := ensureBootstrap(ctx, modelBlocksService, modelblocks.BootstrapSeed{
		Provider:      cfg.Bootstrap.Provider,
		OllamaBaseURL: cfg.Bootstrap.OllamaBaseURL,
		OllamaModel:   cfg.Bootstrap.OllamaModel,
		APIKey:        cfg.Bootstrap.APIKey,
	}); err != nil {
		log.Error("failed to seed bootstrap model block", slog.String("error", err.Error()))
		return fmt.Errorf("failed to seed bootstrap model block: %w", err)
	}

	// MCP Servers Registry (bridges to the Fach-Apps' FastMCP servers)
	mcpServersRepo := mcpservers.NewRepository(dbClient.Pool)
	mcpServersService := mcpservers.NewService(mcpServersRepo, log)
	mcpClientPool := mcp.NewClientPool()
	mcpServersHandler := mcpservers.NewHandler(mcpServersService, mcpClientPool)

	if err := seedMCPServers(ctx, mcpServersService, cfg.MCPServersSpec); err != nil {
		log.Error("failed to seed mcp server registry from CHAT_MCP_SERVERS", slog.String("error", err.Error()))
		return fmt.Errorf("failed to seed mcp server registry: %w", err)
	}

	// Non-blocking background health diagnostic for all registered MCP servers
	go func() {
		diagCtx, diagCancel := context.WithTimeout(parentCtx, 10*time.Second)
		defer diagCancel()
		diags, err := diagnoseMCPServers(diagCtx, mcpServersService, mcpClientPool)
		if err != nil {
			log.Warn("startup mcp server diagnostic check encountered error", slog.String("error", err.Error()))
			return
		}
		for _, d := range diags {
			if d.Reachable {
				log.Info("mcp server online",
					slog.String("app_slug", d.AppSlug),
					slog.String("endpoint", d.EndpointURL),
					slog.Int64("latency_ms", d.LatencyMs),
					slog.Int("tools_count", d.ToolsCount),
				)
			} else {
				log.Warn("mcp server offline or degraded (chat fallback active)",
					slog.String("app_slug", d.AppSlug),
					slog.String("endpoint", d.EndpointURL),
					slog.String("error", d.Error),
				)
			}
		}
	}()

	// S3 / RustFS Storage Client
	storageClient, err := newStorage(ctx, cfg.Storage)
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

	r := buildRouter(log, dbClient, authMw, modelBlocksHandler, conversationsHandler, mcpServersHandler, attachmentsHandler)

	// HTTP Server & Graceful Shutdown.
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 10 * time.Minute,
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

	log.Info("chat-backend service stopped cleanly")
	return nil
}

// buildRouter constructs and configures the chi Router with all middlewares and feature endpoints.
func buildRouter(
	log *slog.Logger,
	dbClient *db.Client,
	authMw func(http.Handler) http.Handler,
	modelBlocksHandler *modelblocks.Handler,
	conversationsHandler *conversations.Handler,
	mcpServersHandler *mcpservers.Handler,
	attachmentsHandler *attachments.Handler,
) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RequestLogger(log))

	r.Get("/api/v1/chat/health", healthHandler(dbClient))

	if authMw != nil {
		if modelBlocksHandler != nil {
			modelBlocksHandler.RegisterRoutes(r, authMw)
		}
		if conversationsHandler != nil {
			conversationsHandler.RegisterRoutes(r, authMw)
		}
		if mcpServersHandler != nil {
			mcpServersHandler.RegisterRoutes(r, authMw)
		}
		if attachmentsHandler != nil {
			attachmentsHandler.RegisterRoutes(r, authMw)
		}
	}
	return r
}

// setupAuthenticator initializes the OIDC JWT authenticator from application configuration.
func setupAuthenticator(cfg *config.Config, log *slog.Logger) (*middleware.Authenticator, error) {
	return middleware.NewAuthenticator(cfg.Keycloak.JWKSURL, cfg.Keycloak.ExpectedIssuer, log)
}

// healthHandler reports service and database connectivity status for compose healthchecks.
func healthHandler(dbClient *db.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if dbClient == nil || dbClient.Pool == nil || dbClient.Pool.Ping(r.Context()) != nil {
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
