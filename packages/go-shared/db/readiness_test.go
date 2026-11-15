package db

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackc/pgx/v5"
)

// fakeRow answers the schema_migrations query.
type fakeRow struct {
	version int64
	dirty   bool
	err     error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*dest[0].(*int64) = r.version
	*dest[1].(*bool) = r.dirty
	return nil
}

type fakeQuerier struct{ row fakeRow }

func (q fakeQuerier) QueryRow(context.Context, string, ...any) pgx.Row { return q.row }

func writeMigrations(t *testing.T, names ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, n := range names {
		if err := os.WriteFile(filepath.Join(dir, n), []byte("SELECT 1;"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestLatestMigration(t *testing.T) {
	dir := writeMigrations(t, "000001_init.up.sql", "000001_init.down.sql", "000012_more.up.sql", "README.md")
	if err := os.Mkdir(filepath.Join(dir, "sub"), 0o700); err != nil {
		t.Fatal(err)
	}
	if got, err := LatestMigration(dir); err != nil || got != 12 {
		t.Errorf("LatestMigration() = %d, %v; want 12", got, err)
	}
	if got, err := LatestMigration(t.TempDir()); err != nil || got != 0 {
		t.Errorf("empty dir: LatestMigration() = %d, %v", got, err)
	}
	for _, bad := range []string{"init.up.sql", "abc_init.up.sql"} {
		if _, err := LatestMigration(writeMigrations(t, bad)); err == nil {
			t.Errorf("%s: want an error", bad)
		}
	}
	if _, err := LatestMigration(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Error("missing dir: want an error")
	}
}

func TestCheckSchema(t *testing.T) {
	ctx := context.Background()
	tests := []struct {
		name    string
		row     fakeRow
		want    uint
		wantErr error
		ok      bool
	}{
		{name: "at head", row: fakeRow{version: 7}, want: 7, ok: true},
		{name: "ahead (newer replica)", row: fakeRow{version: 8}, want: 7, ok: true},
		{name: "behind", row: fakeRow{version: 6}, want: 7, wantErr: ErrSchemaBehind},
		{name: "dirty", row: fakeRow{version: 7, dirty: true}, want: 7, wantErr: ErrSchemaBehind},
		{name: "no migration yet", row: fakeRow{err: pgx.ErrNoRows}, want: 3, wantErr: ErrSchemaBehind},
		{name: "nothing to apply", row: fakeRow{err: pgx.ErrNoRows}, want: 0, ok: true},
		{name: "database down", row: fakeRow{err: errors.New("connection refused")}, want: 1},
	}
	for _, tc := range tests {
		err := CheckSchema(ctx, fakeQuerier{row: tc.row}, tc.want)
		if tc.ok != (err == nil) {
			t.Errorf("%s: CheckSchema() = %v", tc.name, err)
		}
		if tc.wantErr != nil && !errors.Is(err, tc.wantErr) {
			t.Errorf("%s: err = %v, want %v", tc.name, err, tc.wantErr)
		}
	}
	if err := CheckSchema(ctx, nil, 0); err == nil {
		t.Error("nil querier: want an error")
	}
}

func TestClientReadinessCheck(t *testing.T) {
	if _, err := (&Client{}).ReadinessCheck(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Error("missing migrations dir: want an error")
	}
	check, err := (&Client{}).ReadinessCheck(writeMigrations(t, "000001_init.up.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if err := check(context.Background()); err == nil {
		t.Error("client without a pool must not be ready")
	}
}
