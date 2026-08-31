package db

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"alfheim/chat/config"
)

func TestNewClient_InvalidURL(t *testing.T) {
	ctx := context.Background()
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))

	invalidCfg := config.DatabaseConfig{
		URL: "://invalid-url-scheme",
	}

	client, err := NewClient(ctx, invalidCfg, testLogger)
	if err == nil {
		if client != nil {
			client.Close()
		}
		t.Fatal("expected error when parsing invalid PostgreSQL URL, got nil")
	}
}

func TestNewClient_PingFailure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))

	unreachableCfg := config.DatabaseConfig{
		URL:             "postgres://user:pass@127.0.0.1:54321/db?sslmode=disable",
		MaxConns:        5,
		MinConns:        1,
		MaxConnLifetime: 1 * time.Minute,
	}

	client, err := NewClient(ctx, unreachableCfg, testLogger)
	if err == nil {
		if client != nil {
			client.Close()
		}
		t.Fatal("expected error when attempting to connect to unreachable DB, got nil")
	}
}

func TestRunMigrations_InvalidURL(t *testing.T) {
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	client := &Client{
		log: testLogger,
	}

	err := client.RunMigrations("invalid-postgres-url", "migrations")
	if err == nil {
		t.Fatal("expected error when running migrations with invalid DB URL, got nil")
	}
}

func TestClose_NilPool(t *testing.T) {
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	client := &Client{
		Pool: nil,
		log:  testLogger,
	}

	// Should close safely without panicking when Pool is nil
	client.Close()
}
