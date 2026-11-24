package plugins

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
		case *bool:
			*p = r.vals[i].(bool)
		case *[]byte:
			*p = r.vals[i].([]byte)
		case *time.Time:
			*p = r.vals[i].(time.Time)
		case **time.Time:
			*p = r.vals[i].(*time.Time)
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

// fakeDB records the SQL and arguments and answers with configured results.
type fakeDB struct {
	sqls     []string
	args     [][]any
	row      fakeRow
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
	return f.row
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("not used") }

func pluginRow(hh uuid.UUID, typ string) []any {
	now := time.Now()
	return []any{uuid.New(), hh, typ, true, "https://x.example", []byte(`{"a":1}`), []byte{1, 2},
		"v1", "ok", &now, "fine", now, now}
}

func TestRepository_ListAndGetFilterByHousehold(t *testing.T) {
	hh := uuid.New()
	db := &fakeDB{rows: &fakeRows{rows: [][]any{pluginRow(hh, "a"), pluginRow(hh, "b")}}, row: fakeRow{vals: pluginRow(hh, "a")}}
	repo := NewRepository(db)
	recs, err := repo.List(context.Background(), hh)
	if err != nil || len(recs) != 2 || recs[1].Type != "b" || recs[0].HealthStatus != StatusOK || string(recs[0].Config) != `{"a":1}` {
		t.Fatalf("list: %+v %v", recs, err)
	}
	rec, err := repo.Get(context.Background(), hh, "a")
	if err != nil || !rec.HasCredentials() || rec.HealthCheckedAt == nil {
		t.Fatalf("get: %+v %v", rec, err)
	}
	for i, sql := range db.sqls {
		if !strings.Contains(sql, "household_id = $1") || db.args[i][0] != hh {
			t.Fatalf("query %d is not scoped to the household: %s", i, sql)
		}
	}
}

func TestRepository_Errors(t *testing.T) {
	hh, boom := uuid.New(), errors.New("boom")
	for name, db := range map[string]*fakeDB{
		"query":   {queryErr: boom},
		"scan":    {rows: &fakeRows{rows: [][]any{pluginRow(hh, "a")}, scanErr: boom}},
		"iterate": {rows: &fakeRows{iterErr: boom}},
	} {
		if _, err := NewRepository(db).List(context.Background(), hh); !errors.Is(err, boom) {
			t.Errorf("%s: %v", name, err)
		}
	}
	repo := NewRepository(&fakeDB{row: fakeRow{err: pgx.ErrNoRows}})
	if _, err := repo.Get(context.Background(), hh, "a"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("missing row: %v", err)
	}
	repo = NewRepository(&fakeDB{row: fakeRow{err: boom}, execErr: boom})
	if _, err := repo.Get(context.Background(), hh, "a"); !errors.Is(err, boom) {
		t.Fatalf("get error: %v", err)
	}
	if err := repo.Upsert(context.Background(), &Record{}); !errors.Is(err, boom) {
		t.Fatalf("upsert error: %v", err)
	}
	if err := repo.SaveHealth(context.Background(), hh, "a", HealthResult{}); !errors.Is(err, boom) {
		t.Fatalf("save health error: %v", err)
	}
}

func TestRepository_UpsertAndSaveHealth(t *testing.T) {
	hh, id, now := uuid.New(), uuid.New(), time.Now()
	db := &fakeDB{row: fakeRow{vals: []any{id, now, now}}, tag: pgconn.NewCommandTag("UPDATE 1")}
	repo := NewRepository(db)
	rec := &Record{HouseholdID: hh, Type: "a", HealthStatus: StatusOK}
	if err := repo.Upsert(context.Background(), rec); err != nil {
		t.Fatal(err)
	}
	if rec.ID != id || rec.HealthStatus != StatusUnknown || db.args[0][4] != "{}" || !strings.Contains(db.sqls[0], "ON CONFLICT (household_id, type)") {
		t.Fatalf("upsert: %+v %v", rec, db.args[0])
	}
	if err := repo.SaveHealth(context.Background(), hh, "a", HealthResult{Status: StatusOK, CheckedAt: now}); err != nil {
		t.Fatal(err)
	}
	if db.args[1][0] != hh || db.args[1][2] != "ok" {
		t.Fatalf("save health args: %v", db.args[1])
	}
	db.tag = pgconn.NewCommandTag("UPDATE 0")
	if err := repo.SaveHealth(context.Background(), hh, "a", HealthResult{}); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("missing row: %v", err)
	}
}
