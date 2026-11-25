package actions

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

// fakeRow scans fixed values, or returns err.
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

// fakeDB answers QueryRow calls from a queue and records the SQL.
type fakeDB struct {
	sqls     []string
	rowQueue []fakeRow
	rows     pgx.Rows
	queryErr error
	tag      pgconn.CommandTag
	execErr  error
}

func (f *fakeDB) Exec(_ context.Context, sql string, _ ...any) (pgconn.CommandTag, error) {
	f.sqls = append(f.sqls, sql)
	return f.tag, f.execErr
}

func (f *fakeDB) Query(_ context.Context, sql string, _ ...any) (pgx.Rows, error) {
	f.sqls = append(f.sqls, sql)
	return f.rows, f.queryErr
}

func (f *fakeDB) QueryRow(_ context.Context, sql string, _ ...any) pgx.Row {
	f.sqls = append(f.sqls, sql)
	row := f.rowQueue[0]
	f.rowQueue = f.rowQueue[1:]
	return row
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("not used") }

func ruleRow() []any {
	now := time.Now()
	return []any{uuid.New(), hhA, "homeassistant", "washer", ActionCreateChoreInstance, []byte(`{}`), true, now, now}
}

func TestRepository_Rules(t *testing.T) {
	ctx := context.Background()
	db := &fakeDB{rows: &fakeRows{rows: [][]any{ruleRow()}}}
	repo := NewRepository(db)
	rules, err := repo.ListRules(ctx, hhA, "homeassistant")
	if err != nil || len(rules) != 1 || rules[0].EventType != "washer" || !strings.Contains(db.sqls[0], "household_id = $1") {
		t.Fatalf("list: %+v %v", rules, err)
	}
	now := time.Now()
	db.rowQueue = []fakeRow{{vals: []any{uuid.New(), now, now}}, {vals: ruleRow()}, {err: pgx.ErrNoRows}, {err: errors.New("x")}}
	rule := Rule{HouseholdID: hhA, Params: []byte(`{}`)}
	if err := repo.SaveRule(ctx, &rule); err != nil || rule.ID == uuid.Nil {
		t.Fatalf("save: %v", err)
	}
	if r, err := repo.FindRule(ctx, hhA, "homeassistant", "washer"); err != nil || r.Action != ActionCreateChoreInstance {
		t.Fatalf("find: %v", err)
	}
	if _, err := repo.FindRule(ctx, hhA, "homeassistant", "x"); !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if _, err := repo.FindRule(ctx, hhA, "homeassistant", "x"); err == nil || errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("db error: %v", err)
	}
	db.tag = pgconn.NewCommandTag("DELETE 1")
	if err := repo.DeleteRule(ctx, hhA, "homeassistant", uuid.New()); err != nil {
		t.Fatal(err)
	}
	db.tag = pgconn.NewCommandTag("DELETE 0")
	if err := repo.DeleteRule(ctx, hhA, "homeassistant", uuid.New()); !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("delete missing: %v", err)
	}
	db.execErr = errors.New("x")
	if err := repo.DeleteRule(ctx, hhA, "homeassistant", uuid.New()); err == nil {
		t.Fatal("delete error")
	}
	db.rowQueue = []fakeRow{{err: errors.New("x")}}
	if err := repo.SaveRule(ctx, &rule); err == nil {
		t.Fatal("save error")
	}
}

func TestRepository_Events(t *testing.T) {
	ctx := context.Background()
	ev := Event{PluginID: uuid.New(), HouseholdID: hhA, EventID: "e", EventType: "t"}
	db := &fakeDB{rowQueue: []fakeRow{
		{vals: []any{uuid.New()}},
		{err: pgx.ErrNoRows}, {vals: []any{"executed"}},
		{err: errors.New("x")},
		{err: pgx.ErrNoRows}, {err: errors.New("x")},
	}}
	repo := NewRepository(db)
	if ok, st, err := repo.InsertEvent(ctx, ev); !ok || st != StatusReceived || err != nil {
		t.Fatalf("insert: %v %v %v", ok, st, err)
	}
	if ok, st, err := repo.InsertEvent(ctx, ev); ok || st != StatusExecuted || err != nil {
		t.Fatalf("replay: %v %v %v", ok, st, err)
	}
	if _, _, err := repo.InsertEvent(ctx, ev); err == nil {
		t.Fatal("insert error")
	}
	if _, _, err := repo.InsertEvent(ctx, ev); err == nil {
		t.Fatal("replay read error")
	}
	if err := repo.FinishEvent(ctx, ev, "a", Result{Status: StatusExecuted, Detail: strings.Repeat("x", 600)}); err != nil {
		t.Fatal(err)
	}
	db.execErr = errors.New("x")
	if err := repo.FinishEvent(ctx, ev, "a", Result{}); err == nil {
		t.Fatal("finish error")
	}
	db.rows = &fakeRows{rows: [][]any{{"e", "t", "executed", "a", "", time.Now()}}}
	recs, err := repo.RecentEvents(ctx, hhA, "homeassistant")
	if err != nil || len(recs) != 1 || recs[0].Status != StatusExecuted || !strings.Contains(db.sqls[len(db.sqls)-1], "LIMIT $3") {
		t.Fatalf("recent: %+v %v", recs, err)
	}
}

func TestRepository_QueryFailures(t *testing.T) {
	ctx := context.Background()
	for name, db := range map[string]*fakeDB{
		"query": {queryErr: errors.New("x")},
		"scan":  {rows: &fakeRows{rows: [][]any{{}}, scanErr: errors.New("x")}},
		"iter":  {rows: &fakeRows{iterErr: errors.New("x")}},
	} {
		repo := NewRepository(db)
		if _, err := repo.ListRules(ctx, hhA, "homeassistant"); err == nil {
			t.Errorf("%s: rules", name)
		}
		if r, ok := db.rows.(*fakeRows); ok {
			r.idx = 0
		}
		if _, err := repo.RecentEvents(ctx, hhA, "homeassistant"); err == nil {
			t.Errorf("%s: events", name)
		}
	}
	if truncate("äbc", 2) != "äb" || truncate("ab", 5) != "ab" {
		t.Error("truncate")
	}
}
