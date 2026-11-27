package servicebindings_test

// PostgreSQL integration test of the service_bindings table (#958). It runs only
// when HOUSEHOLD_TEST_DATABASE_URL points at a disposable database; see
// internal/features/household/integration_test.go for the setup command. The
// public schema of that database is dropped and recreated.

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/go-shared/auth"
	"alfheim/household/internal/features/household"
	"alfheim/household/internal/features/servicebindings"
)

func TestIntegration_ServiceBindingLifecycle(t *testing.T) {
	dbURL := os.Getenv("HOUSEHOLD_TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("HOUSEHOLD_TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		t.Fatalf("reset schema: %v", err)
	}
	migrationsDir, err := filepath.Abs("../../../migrations")
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.New("file://"+migrationsDir, dbURL)
	if err != nil {
		t.Fatalf("migrate init: %v", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatalf("migrate up: %v", err)
	}
	_, _ = m.Close()

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	households := household.NewRepository(pool)
	hh, err := household.NewService(households, log).CreateHousehold(ctx, &auth.UserClaims{Subject: "owner"}, household.CreateHouseholdRequest{Name: "Bound"})
	if err != nil {
		t.Fatal(err)
	}
	svc := servicebindings.NewService(servicebindings.NewRepository(pool), households, servicebindings.NewPrincipals([]string{"machine"}), log)
	req := servicebindings.CreateRequest{PrincipalID: "machine", Scopes: []string{"chores:create_instance"}}

	if _, created, err := svc.Create(ctx, "owner", hh.ID, req); err != nil || !created {
		t.Fatalf("create: created=%v err=%v", created, err)
	}
	req.Scopes = append(req.Scopes, "pantry:add_item")
	if b, created, err := svc.Create(ctx, "owner", hh.ID, req); err != nil || created || len(b.Scopes) != 2 || b.CreatedBy != "owner" {
		t.Fatalf("update: %+v created=%v err=%v", b, created, err)
	}
	if b, err := svc.Resolve(ctx, hh.ID, "machine"); err != nil || len(b.Scopes) != 2 {
		t.Fatalf("resolve: %+v err=%v", b, err)
	}
	if list, err := svc.List(ctx, "owner", hh.ID); err != nil || len(list) != 1 {
		t.Fatalf("list: %+v err=%v", list, err)
	}
	if err := svc.Revoke(ctx, "owner", hh.ID, "machine"); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, err := svc.Resolve(ctx, hh.ID, "machine"); !errors.Is(err, servicebindings.ErrNotFound) {
		t.Fatalf("resolve after revoke: %v", err)
	}

	// Deleting the household removes its bindings.
	if _, _, err := svc.Create(ctx, "owner", hh.ID, req); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM households WHERE id = $1`, hh.ID); err != nil {
		t.Fatal(err)
	}
	var left int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM service_bindings`).Scan(&left); err != nil || left != 0 {
		t.Fatalf("bindings left after household delete: %d err=%v", left, err)
	}
}
