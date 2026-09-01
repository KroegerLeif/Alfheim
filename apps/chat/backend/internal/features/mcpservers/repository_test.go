package mcpservers

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockRow struct {
	scanFunc func(dest ...any) error
}

func (r *mockRow) Scan(dest ...any) error {
	if r.scanFunc != nil {
		return r.scanFunc(dest...)
	}
	return pgx.ErrNoRows
}

type mockRows struct {
	items [][]any
	idx   int
	err   error
}

func (m *mockRows) Close()                                       {}
func (m *mockRows) Err() error                                   { return m.err }
func (m *mockRows) CommandTag() pgconn.CommandTag                { return pgconn.NewCommandTag("") }
func (m *mockRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (m *mockRows) Conn() *pgx.Conn                              { return nil }

func (m *mockRows) Next() bool {
	if m.err != nil || m.idx >= len(m.items) {
		return false
	}
	m.idx++
	return true
}

func (m *mockRows) Scan(dest ...any) error {
	if m.idx == 0 || m.idx > len(m.items) {
		return pgx.ErrNoRows
	}
	row := m.items[m.idx-1]
	for i, val := range row {
		if i >= len(dest) {
			break
		}
		switch d := dest[i].(type) {
		case *string:
			if val != nil {
				*d = val.(string)
			}
		case *bool:
			if val != nil {
				*d = val.(bool)
			}
		case *time.Time:
			if val != nil {
				*d = val.(time.Time)
			}
		}
	}
	return nil
}

func (m *mockRows) Values() ([]any, error) { return nil, nil }
func (m *mockRows) RawValues() [][]byte    { return nil }

type mockDBTX struct {
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
	execFunc     func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	queryFunc    func(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func (m *mockDBTX) Begin(ctx context.Context) (pgx.Tx, error) { return nil, nil }

func (m *mockDBTX) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if m.execFunc != nil {
		return m.execFunc(ctx, sql, arguments...)
	}
	return pgconn.NewCommandTag(""), nil
}

func (m *mockDBTX) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, sql, args...)
	}
	return &mockRows{}, nil
}

func (m *mockDBTX) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
	return &mockRow{}
}

func TestRepository_MCPServers(t *testing.T) {
	ctx := context.Background()

	t.Run("UpsertFromSeed and SetEnabled success", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtxOK)
		if err := repo.UpsertFromSeed(ctx, "budget", "http://budget:8080"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if err := repo.SetEnabled(ctx, "s1", true); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("SetEnabled 0 rows affected returns ErrNotFound", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.SetEnabled(ctx, "s999", false); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("GetByID ErrNotFound and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetByID(ctx, "s999"); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "s1"
					*dest[1].(*string) = "budget"
					*dest[2].(*string) = "http://budget:8080"
					*dest[3].(*bool) = true
					*dest[6].(*time.Time) = now
					*dest[7].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		s, err := repoOK.GetByID(ctx, "s1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if s.AppSlug != "budget" || !s.Enabled {
			t.Errorf("unexpected server: %+v", s)
		}
	})

	t.Run("List and ListEnabled success", func(t *testing.T) {
		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"s1", "budget", "http://budget:8080", true, nil, nil, now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)

		list, err := repoOK.List(ctx)
		if err != nil || len(list) != 1 {
			t.Fatalf("unexpected list err: %v list: %+v", err, list)
		}

		listEnabled, err := repoOK.ListEnabled(ctx)
		if err != nil || len(listEnabled) != 1 {
			t.Fatalf("unexpected listEnabled err: %v list: %+v", err, listEnabled)
		}
	})
}

func TestNewRepository(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}
