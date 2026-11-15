package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
)

// migrationTestDatabaseEnv names a PostgreSQL URL for an admin connection.
// The round-trip test creates and drops its own scratch database on it and is
// skipped when the variable is unset (CI provides a service container).
const migrationTestDatabaseEnv = "ALFHEIM_MIGRATION_TEST_DATABASE_URL"

// TestMigrations_FullRoundTrip guards the down chain: every up migration must
// apply on an empty database and every down migration must undo it back to
// version 0, twice in a row, so a broken rollback (#916) fails the build.
func TestMigrations_FullRoundTrip(t *testing.T) {
	adminURL := os.Getenv(migrationTestDatabaseEnv)
	if adminURL == "" {
		t.Skipf("%s is not set; skipping the PostgreSQL migration round trip", migrationTestDatabaseEnv)
	}

	scratchURL := createScratchDatabase(t, adminURL)
	sourceURL := "file://" + filepath.Join("..", "..", "migrations")

	m, err := migrate.New(sourceURL, scratchURL)
	if err != nil {
		t.Fatalf("open migrations: %v", err)
	}
	t.Cleanup(func() {
		if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
			t.Errorf("close migrations: source=%v database=%v", srcErr, dbErr)
		}
	})

	for round := 1; round <= 2; round++ {
		if err := m.Up(); err != nil {
			t.Fatalf("round %d: up: %v", round, err)
		}
		if err := m.Down(); err != nil {
			t.Fatalf("round %d: down: %v", round, err)
		}
		if _, _, err := m.Version(); !errors.Is(err, migrate.ErrNilVersion) {
			t.Fatalf("round %d: expected no version after a full down migration, got %v", round, err)
		}
	}
}

// createScratchDatabase creates a uniquely named database on the server behind
// adminURL, registers its removal and returns a URL pointing at it.
func createScratchDatabase(t *testing.T, adminURL string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Fatalf("connect admin database: %v", err)
	}
	defer func() {
		if err := conn.Close(context.Background()); err != nil {
			t.Errorf("close admin connection: %v", err)
		}
	}()

	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		t.Fatalf("random suffix: %v", err)
	}
	name := "dashboard_migrations_" + hex.EncodeToString(suffix)
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); err != nil {
		t.Fatalf("create scratch database: %v", err)
	}
	t.Cleanup(func() {
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer dropCancel()
		dropConn, err := pgx.Connect(dropCtx, adminURL)
		if err != nil {
			t.Errorf("connect admin database for cleanup: %v", err)
			return
		}
		defer func() { _ = dropConn.Close(context.Background()) }()
		if _, err := dropConn.Exec(dropCtx, "DROP DATABASE IF EXISTS "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)"); err != nil {
			t.Errorf("drop scratch database: %v", err)
		}
	})

	u, err := url.Parse(adminURL)
	if err != nil {
		t.Fatalf("parse admin url: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}
