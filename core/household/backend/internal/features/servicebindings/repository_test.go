package servicebindings

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type scanRow struct{ fn func(dest ...any) error }

func (r scanRow) Scan(dest ...any) error { return r.fn(dest...) }

type fakeRows struct {
	pgx.Rows
	rows    []Binding
	idx     int
	scanErr error
	err     error
}

func (f *fakeRows) Close()     {}
func (f *fakeRows) Err() error { return f.err }
func (f *fakeRows) Next() bool { f.idx++; return f.idx <= len(f.rows) }
func (f *fakeRows) Scan(dest ...any) error {
	if f.scanErr != nil {
		return f.scanErr
	}
	return fillBinding(f.rows[f.idx-1], dest)
}

func fillBinding(b Binding, dest []any) error {
	*dest[0].(*string), *dest[1].(*string) = b.PrincipalID, b.HouseholdID
	*dest[2].(*[]string), *dest[3].(*string), *dest[4].(*time.Time) = b.Scopes, b.CreatedBy, b.CreatedAt
	return nil
}

type fakeDB struct {
	row     pgx.Row
	rows    pgx.Rows
	rowsErr error
	tag     pgconn.CommandTag
	execErr error
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("unused") }
func (f *fakeDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return f.tag, f.execErr
}
func (f *fakeDB) Query(context.Context, string, ...any) (pgx.Rows, error) { return f.rows, f.rowsErr }
func (f *fakeDB) QueryRow(context.Context, string, ...any) pgx.Row        { return f.row }

func TestRepository_Upsert(t *testing.T) {
	now := time.Now()
	repo := newRepositoryWithDB(&fakeDB{row: scanRow{fn: func(dest ...any) error {
		*dest[0].(*string), *dest[1].(*time.Time), *dest[2].(*bool) = admin, now, true
		return nil
	}}})
	b := &Binding{PrincipalID: principal, HouseholdID: hhID, Scopes: []string{scope}, CreatedBy: "other"}
	if created, err := repo.Upsert(context.Background(), b); err != nil || !created || b.CreatedBy != admin || !b.CreatedAt.Equal(now) {
		t.Fatalf("upsert: %+v created=%v err=%v", b, created, err)
	}
	failing := newRepositoryWithDB(&fakeDB{row: scanRow{fn: func(...any) error { return errDB }}})
	if _, err := failing.Upsert(context.Background(), b); !errors.Is(err, errDB) {
		t.Fatalf("upsert failure: %v", err)
	}
}

func TestRepository_ListFindDelete(t *testing.T) {
	ctx := context.Background()
	want := Binding{PrincipalID: principal, HouseholdID: hhID, Scopes: []string{scope}, CreatedBy: admin, CreatedAt: time.Now()}

	list, err := newRepositoryWithDB(&fakeDB{rows: &fakeRows{rows: []Binding{want}}}).List(ctx, hhID)
	if err != nil || len(list) != 1 || list[0].PrincipalID != principal {
		t.Fatalf("list: %+v err=%v", list, err)
	}
	for name, db := range map[string]*fakeDB{
		"query": {rowsErr: errDB},
		"scan":  {rows: &fakeRows{rows: []Binding{want}, scanErr: errDB}},
		"rows":  {rows: &fakeRows{err: errDB}},
	} {
		if _, err := newRepositoryWithDB(db).List(ctx, hhID); !errors.Is(err, errDB) {
			t.Errorf("list %s failure: %v", name, err)
		}
	}

	found := newRepositoryWithDB(&fakeDB{row: scanRow{fn: func(dest ...any) error { return fillBinding(want, dest) }}})
	if got, err := found.Find(ctx, hhID, principal); err != nil || got.CreatedBy != admin {
		t.Fatalf("find: %+v err=%v", got, err)
	}
	missing := newRepositoryWithDB(&fakeDB{row: scanRow{fn: func(...any) error { return pgx.ErrNoRows }}})
	if _, err := missing.Find(ctx, hhID, principal); !errors.Is(err, ErrNotFound) {
		t.Fatalf("find missing: %v", err)
	}
	broken := newRepositoryWithDB(&fakeDB{row: scanRow{fn: func(...any) error { return errDB }}})
	if _, err := broken.Find(ctx, hhID, principal); !errors.Is(err, errDB) {
		t.Fatalf("find failure: %v", err)
	}

	if err := newRepositoryWithDB(&fakeDB{tag: pgconn.NewCommandTag("DELETE 1")}).Delete(ctx, hhID, principal); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := newRepositoryWithDB(&fakeDB{tag: pgconn.NewCommandTag("DELETE 0")}).Delete(ctx, hhID, principal); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
	if err := newRepositoryWithDB(&fakeDB{execErr: errDB}).Delete(ctx, hhID, principal); !errors.Is(err, errDB) {
		t.Fatalf("delete failure: %v", err)
	}
	if NewRepository(nil) == nil {
		t.Fatal("NewRepository returned nil")
	}
}
