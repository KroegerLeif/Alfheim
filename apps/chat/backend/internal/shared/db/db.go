// Package db manages PostgreSQL database connection pools and database schema migrations.
package db

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/chat/config"
)

// DBTX abstracts database execution operations (satisfied by *pgxpool.Pool and pgx.Tx).
type DBTX interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Client holds the connection pool reference and manages database operations.
type Client struct {
	Pool *pgxpool.Pool
	log  *slog.Logger
}

// NewClient initializes a pgxpool PostgreSQL connection pool and verifies connectivity.
func NewClient(ctx context.Context, cfg config.DatabaseConfig, log *slog.Logger) (*Client, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse postgresql connection url: %w", err)
	}

	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MinConns = cfg.MinConns
	poolCfg.MaxConnLifetime = cfg.MaxConnLifetime

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create postgresql connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping postgresql database: %w", err)
	}

	log.Info("successfully established postgresql connection pool",
		slog.Int("max_conns", int(cfg.MaxConns)),
		slog.Int("min_conns", int(cfg.MinConns)),
	)

	return &Client{
		Pool: pool,
		log:  log,
	}, nil
}

// RunMigrations executes up-migrations located in the specified directory using golang-migrate.
func (c *Client) RunMigrations(dbURL string, migrationsDir string) error {
	absPath, err := filepath.Abs(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to get absolute path for migrations directory %s: %w", migrationsDir, err)
	}

	sourceURL := fmt.Sprintf("file://%s", absPath)
	m, err := migrate.New(sourceURL, dbURL)
	if err != nil {
		return fmt.Errorf("failed to create golang-migrate instance: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to execute postgresql schema migrations: %w", err)
	}

	c.log.Info("postgresql database migrations executed successfully")
	return nil
}

// Close gracefully closes the underlying pgxpool connection pool.
func (c *Client) Close() {
	if c.Pool != nil {
		c.Pool.Close()
		c.log.Info("postgresql connection pool closed")
	}
}
