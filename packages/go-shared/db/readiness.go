package db

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

// RowQuerier is the part of a connection pool the schema check needs
// (satisfied by *pgxpool.Pool).
type RowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ErrSchemaBehind reports a database whose golang-migrate version is older
// than the newest migration shipped with the binary, or left dirty by a
// failed migration.
var ErrSchemaBehind = errors.New("database schema is not at the latest migration")

// LatestMigration returns the highest version among the golang-migrate
// up-migrations (NNN_name.up.sql) in dir. A directory without migrations
// yields 0.
func LatestMigration(dir string) (uint, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, fmt.Errorf("read migrations directory %s: %w", dir, err)
	}
	var latest uint
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		prefix, _, found := strings.Cut(name, "_")
		if !found {
			return 0, fmt.Errorf("migration %s has no version prefix", name)
		}
		version, err := strconv.ParseUint(prefix, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("migration %s has an invalid version: %w", name, err)
		}
		latest = max(latest, uint(version))
	}
	return latest, nil
}

// CheckSchema verifies that the database answers and that golang-migrate's
// schema_migrations table records want or a newer version without the dirty
// flag. A newer version is accepted so an older replica stays ready while a
// newer one rolls out.
func CheckSchema(ctx context.Context, q RowQuerier, want uint) error {
	if q == nil {
		return errors.New("database is not configured")
	}
	var version int64
	var dirty bool
	err := q.QueryRow(ctx, "SELECT version, dirty FROM schema_migrations LIMIT 1").Scan(&version, &dirty)
	if errors.Is(err, pgx.ErrNoRows) {
		if want == 0 {
			return nil
		}
		return fmt.Errorf("%w: no migration applied, want %d", ErrSchemaBehind, want)
	}
	if err != nil {
		return fmt.Errorf("query schema version: %w", err)
	}
	if dirty {
		return fmt.Errorf("%w: version %d is dirty", ErrSchemaBehind, version)
	}
	if version < 0 || uint(version) < want {
		return fmt.Errorf("%w: version %d, want %d", ErrSchemaBehind, version, want)
	}
	return nil
}

// ReadinessCheck returns the check behind a backend's /readyz: the pool must
// answer and the schema must be at the newest migration in migrationsDir,
// which is read once here.
func (c *Client) ReadinessCheck(migrationsDir string) (func(ctx context.Context) error, error) {
	want, err := LatestMigration(migrationsDir)
	if err != nil {
		return nil, err
	}
	return func(ctx context.Context) error {
		if c == nil || c.Pool == nil {
			return errors.New("database is not configured")
		}
		return CheckSchema(ctx, c.Pool, want)
	}, nil
}
