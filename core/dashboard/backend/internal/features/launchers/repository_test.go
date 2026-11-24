package launchers

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

// fakeRow scans fixed values into the destinations, or returns err.
type fakeRow struct {
	vals []any
	err  error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for i, d := range dest {
		switch p := d.(type) {
		case *uuid.UUID:
			*p = r.vals[i].(uuid.UUID)
		case *string:
			*p = r.vals[i].(string)
		case *int:
			*p = r.vals[i].(int)
		case *time.Time:
			*p = r.vals[i].(time.Time)
		}
	}
	return nil
}

type fakeRows struct {
	rows    [][]any
	idx     int
	scanErr error
	iterErr error
}

func (r *fakeRows) Close()                                       {}
func (r *fakeRows) Err() error                                   { return r.iterErr }
func (r *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.NewCommandTag("") }
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRows) Values() ([]any, error)                       { return nil, nil }
func (r *fakeRows) RawValues() [][]byte                          { return nil }
func (r *fakeRows) Conn() *pgx.Conn                              { return nil }
func (r *fakeRows) TypeMap() *pgtype.Map                         { return nil }
func (r *fakeRows) Next() bool                                   { r.idx++; return r.idx <= len(r.rows) }
func (r *fakeRows) Scan(dest ...any) error {
	if r.scanErr != nil {
		return r.scanErr
	}
	return fakeRow{vals: r.rows[r.idx-1]}.Scan(dest...)
}

var _ pgx.Rows = (*fakeRows)(nil)

// fakeDB records the last SQL and arguments and answers with configured results.
type fakeDB struct {
	sqls     []string
	args     [][]any
	row      func(sql string) pgx.Row
	rows     pgx.Rows
	queryErr error
	tag      pgconn.CommandTag
	execErr  error
}

func (f *fakeDB) record(sql string, args []any) {
	f.sqls = append(f.sqls, sql)
	f.args = append(f.args, args)
}

func (f *fakeDB) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.record(sql, args)
	return f.tag, f.execErr
}

func (f *fakeDB) Query(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
	f.record(sql, args)
	return f.rows, f.queryErr
}

func (f *fakeDB) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	f.record(sql, args)
	return f.row(sql)
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("not used") }

func launcherRow(hh uuid.UUID, title string) []any {
	now := time.Now()
	return []any{uuid.New(), hh, title, "https://a.example", "link", "", 0, "admin", now, now}
}

func TestRepository_ListFiltersByHousehold(t *testing.T) {
	hh := uuid.New()
	db := &fakeDB{
		row:  func(string) pgx.Row { return fakeRow{vals: []any{2}} },
		rows: &fakeRows{rows: [][]any{launcherRow(hh, "A"), launcherRow(hh, "B")}},
	}
	page, err := NewRepository(db).List(context.Background(), hh, 10, 5)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 || len(page.Items) != 2 || page.Items[1].Title != "B" {
		t.Fatalf("unexpected page %+v", page)
	}
	for i, sql := range db.sqls {
		if !strings.Contains(sql, "household_id = $1") || db.args[i][0] != hh {
			t.Fatalf("query %d is not scoped to the household: %s %v", i, sql, db.args[i])
		}
	}
	if db.args[1][1] != 10 || db.args[1][2] != 5 {
		t.Fatalf("limit/offset not passed: %v", db.args[1])
	}
}

func TestRepository_ListErrors(t *testing.T) {
	hh := uuid.New()
	count := func(string) pgx.Row { return fakeRow{vals: []any{1}} }
	boom := errors.New("boom")
	cases := map[string]*fakeDB{
		"count":   {row: func(string) pgx.Row { return fakeRow{err: boom} }},
		"query":   {row: count, queryErr: boom},
		"scan":    {row: count, rows: &fakeRows{rows: [][]any{launcherRow(hh, "A")}, scanErr: boom}},
		"iterate": {row: count, rows: &fakeRows{iterErr: boom}},
	}
	for name, db := range cases {
		if _, err := NewRepository(db).List(context.Background(), hh, 1, 0); !errors.Is(err, boom) {
			t.Errorf("%s: err = %v, want boom", name, err)
		}
	}
}

func TestRepository_Create(t *testing.T) {
	id, now := uuid.New(), time.Now()
	db := &fakeDB{row: func(string) pgx.Row { return fakeRow{vals: []any{id, now, now}} }}
	l := &Launcher{HouseholdID: uuid.New(), Title: "J", URL: "https://j.example", Icon: "film", CreatedBy: "admin"}
	if err := NewRepository(db).Create(context.Background(), l); err != nil {
		t.Fatal(err)
	}
	if l.ID != id || db.args[0][0] != l.HouseholdID || db.args[0][6] != "admin" {
		t.Fatalf("unexpected insert: %+v %v", l, db.args[0])
	}

	db.row = func(string) pgx.Row { return fakeRow{err: errors.New("unique")} }
	if err := NewRepository(db).Create(context.Background(), l); err == nil {
		t.Fatal("expected insert error")
	}
}

func TestRepository_Update(t *testing.T) {
	now := time.Now()
	l := &Launcher{ID: uuid.New(), HouseholdID: uuid.New(), Title: "J"}
	db := &fakeDB{row: func(string) pgx.Row { return fakeRow{vals: []any{"admin", now, now}} }}
	if err := NewRepository(db).Update(context.Background(), l); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(db.sqls[0], "WHERE id = $1 AND household_id = $2") || db.args[0][1] != l.HouseholdID || l.CreatedBy != "admin" {
		t.Fatalf("update not scoped: %s %v", db.sqls[0], db.args[0])
	}

	db.row = func(string) pgx.Row { return fakeRow{err: pgx.ErrNoRows} }
	if err := NewRepository(db).Update(context.Background(), l); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	db.row = func(string) pgx.Row { return fakeRow{err: errors.New("down")} }
	if err := NewRepository(db).Update(context.Background(), l); err == nil || errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want a database error", err)
	}
}

func TestRepository_Delete(t *testing.T) {
	hh, id := uuid.New(), uuid.New()
	db := &fakeDB{tag: pgconn.NewCommandTag("DELETE 1")}
	if err := NewRepository(db).Delete(context.Background(), hh, id); err != nil {
		t.Fatal(err)
	}
	if db.args[0][0] != id || db.args[0][1] != hh {
		t.Fatalf("delete not scoped: %v", db.args[0])
	}
	db.tag = pgconn.NewCommandTag("DELETE 0")
	if err := NewRepository(db).Delete(context.Background(), hh, id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	db.execErr = errors.New("down")
	if err := NewRepository(db).Delete(context.Background(), hh, id); err == nil || errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want a database error", err)
	}
}
