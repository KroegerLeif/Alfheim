package db

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"log/slog"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/jackc/pgx/v5/pgxpool"

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

func TestClose_WithPool(t *testing.T) {
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	pool, err := pgxpool.New(context.Background(), "postgres://user:pass@127.0.0.1:54321/db?sslmode=disable")
	if err != nil {
		t.Fatalf("unexpected error creating pool: %v", err)
	}
	client := &Client{
		Pool: pool,
		log:  testLogger,
	}
	client.Close()
}

func TestNewClient_PoolCreationError(t *testing.T) {
	origPoolFunc := newPoolWithConfig
	defer func() {
		newPoolWithConfig = origPoolFunc
	}()

	newPoolWithConfig = func(ctx context.Context, config *pgxpool.Config) (*pgxpool.Pool, error) {
		return nil, errors.New("simulated pool creation error")
	}

	ctx := context.Background()
	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cfg := config.DatabaseConfig{
		URL: "postgres://user:pass@127.0.0.1:5432/db?sslmode=disable",
	}

	client, err := NewClient(ctx, cfg, testLogger)
	if err == nil {
		if client != nil {
			client.Close()
		}
		t.Fatal("expected error from NewClient when pool creation fails, got nil")
	}
	if !strings.Contains(err.Error(), "simulated pool creation error") {
		t.Errorf("unexpected error: %v", err)
	}
}

func startMockPGServer(t *testing.T) (string, func()) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				buf := make([]byte, 1024)
				n, err := c.Read(buf)
				if err != nil || n < 8 {
					return
				}
				code := binary.BigEndian.Uint32(buf[4:8])
				if code == 80877103 {
					_, _ = c.Write([]byte{'N'})
					n, err = c.Read(buf)
					if err != nil || n < 8 {
						return
					}
				}

				// Respond with Auth OK ('R'), BackendKeyData ('K'), ReadyForQuery ('Z')
				authOk := []byte{
					'R', 0, 0, 0, 8, 0, 0, 0, 0,
					'K', 0, 0, 0, 12, 0, 0, 0, 1, 0, 0, 0, 1,
					'Z', 0, 0, 0, 5, 'I',
				}
				_, _ = c.Write(authOk)

				for {
					n, err := c.Read(buf)
					if err != nil || n == 0 {
						return
					}
					// EmptyQueryResponse ('I') + ReadyForQuery ('Z')
					resp := []byte{
						'I', 0, 0, 0, 4,
						'Z', 0, 0, 0, 5, 'I',
					}
					_, _ = c.Write(resp)
				}
			}(conn)
		}
	}()

	return ln.Addr().String(), func() {
		_ = ln.Close()
	}
}

func TestNewClient_Success(t *testing.T) {
	addr, cleanup := startMockPGServer(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	validCfg := config.DatabaseConfig{
		URL:             "postgres://user:pass@" + addr + "/db?sslmode=disable",
		MaxConns:        2,
		MinConns:        1,
		MaxConnLifetime: 1 * time.Minute,
	}

	client, err := NewClient(ctx, validCfg, testLogger)
	if err != nil {
		t.Fatalf("expected successful DB connection, got %v", err)
	}
	if client == nil || client.Pool == nil {
		t.Fatal("expected non-nil Client and Pool")
	}
	client.Close()
}

type mockMigrator struct {
	upErr  error
	closed bool
}

func (m *mockMigrator) Up() error {
	return m.upErr
}

func (m *mockMigrator) Close() (error, error) {
	m.closed = true
	return nil, nil
}

func TestRunMigrations_TableDriven(t *testing.T) {
	originalMigrate := newMigrate
	defer func() {
		newMigrate = originalMigrate
	}()

	testLogger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	client := &Client{log: testLogger}

	t.Run("successfully executes migrations", func(t *testing.T) {
		mig := &mockMigrator{upErr: nil}
		newMigrate = func(sourceURL, dbURL string) (migrator, error) {
			return mig, nil
		}

		err := client.RunMigrations("postgres://user:pass@localhost:5432/db", "migrations")
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if !mig.closed {
			t.Errorf("expected migrator to be closed")
		}
	})

	t.Run("handles ErrNoChange as success", func(t *testing.T) {
		mig := &mockMigrator{upErr: migrate.ErrNoChange}
		newMigrate = func(sourceURL, dbURL string) (migrator, error) {
			return mig, nil
		}

		err := client.RunMigrations("postgres://user:pass@localhost:5432/db", "migrations")
		if err != nil {
			t.Fatalf("expected ErrNoChange to be ignored, got %v", err)
		}
		if !mig.closed {
			t.Errorf("expected migrator to be closed")
		}
	})

	t.Run("returns error when Up fails with another error", func(t *testing.T) {
		mig := &mockMigrator{upErr: errors.New("migration syntax error")}
		newMigrate = func(sourceURL, dbURL string) (migrator, error) {
			return mig, nil
		}

		err := client.RunMigrations("postgres://user:pass@localhost:5432/db", "migrations")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "migration syntax error") {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("returns error when newMigrate fails", func(t *testing.T) {
		newMigrate = func(sourceURL, dbURL string) (migrator, error) {
			return nil, errors.New("cannot create migrator")
		}

		err := client.RunMigrations("postgres://user:pass@localhost:5432/db", "migrations")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "cannot create migrator") {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("calls default newMigrate implementation", func(t *testing.T) {
		err := client.RunMigrations("invalid-url", "invalid-dir")
		if err == nil {
			t.Fatal("expected error from default newMigrate, got nil")
		}
	})
}
