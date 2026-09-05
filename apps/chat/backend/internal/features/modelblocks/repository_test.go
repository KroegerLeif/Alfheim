package modelblocks

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
		case **string:
			if val != nil {
				str := val.(string)
				*d = &str
			} else {
				*d = nil
			}
		case *bool:
			if val != nil {
				*d = val.(bool)
			}
		case *time.Time:
			if val != nil {
				*d = val.(time.Time)
			}
		case **time.Time:
			if val != nil {
				t := val.(time.Time)
				*d = &t
			}
		}
	}
	return nil
}

func (m *mockRows) Values() ([]any, error) { return nil, nil }
func (m *mockRows) RawValues() [][]byte    { return nil }

type mockTx struct {
	execFunc func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

func (m *mockTx) Begin(ctx context.Context) (pgx.Tx, error) { return m, nil }
func (m *mockTx) Commit(ctx context.Context) error          { return nil }
func (m *mockTx) Rollback(ctx context.Context) error        { return nil }
func (m *mockTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (m *mockTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (m *mockTx) LargeObjects() pgx.LargeObjects                               { return pgx.LargeObjects{} }
func (m *mockTx) Conn() *pgx.Conn                                              { return nil }
func (m *mockTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (m *mockTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if m.execFunc != nil {
		return m.execFunc(ctx, sql, arguments...)
	}
	return pgconn.NewCommandTag(""), nil
}
func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}
func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return &mockRow{}
}

type mockDBTX struct {
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
	execFunc     func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	queryFunc    func(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	beginFunc    func(ctx context.Context) (pgx.Tx, error)
}

func (m *mockDBTX) Begin(ctx context.Context) (pgx.Tx, error) {
	if m.beginFunc != nil {
		return m.beginFunc(ctx)
	}
	return &mockTx{}, nil
}

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

func TestRepository_ModelBlocks(t *testing.T) {
	ctx := context.Background()

	t.Run("Create, Update, Delete, UpdateHealth success", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("OK 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtxOK)
		mb := &ModelBlock{ID: "mb1", DisplayName: "Ollama Local"}

		if err := repo.Create(ctx, mb); err != nil {
			t.Fatalf("unexpected Create err: %v", err)
		}
		if err := repo.Update(ctx, mb); err != nil {
			t.Fatalf("unexpected Update err: %v", err)
		}
		if err := repo.UpdateHealth(ctx, "mb1", HealthStatusOK, nil, time.Now()); err != nil {
			t.Fatalf("unexpected UpdateHealth err: %v", err)
		}
		if err := repo.Delete(ctx, "mb1"); err != nil {
			t.Fatalf("unexpected Delete err: %v", err)
		}
	})

	t.Run("GetByID ErrNotFound and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetByID(ctx, "mb999"); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "mb1"
					*dest[4].(*string) = "ollama"
					*dest[5].(*string) = "Ollama Local"
					*dest[15].(*time.Time) = now
					*dest[16].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		mb, err := repoOK.GetByID(ctx, "mb1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mb.DisplayName != "Ollama Local" {
			t.Errorf("unexpected mb: %+v", mb)
		}
	})

	t.Run("HasBootstrapRun and CreateBootstrap", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*bool) = true
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)

		hasRun, err := repoOK.HasBootstrapRun(ctx, "k1")
		if err != nil || !hasRun {
			t.Fatalf("unexpected HasBootstrapRun err: %v, hasRun: %v", err, hasRun)
		}

		if err := repoOK.CreateBootstrap(ctx, "k1", &ModelBlock{ID: "mb-boot"}); err != nil {
			t.Fatalf("unexpected CreateBootstrap err: %v", err)
		}
	})

	t.Run("ListVisibleTo success", func(t *testing.T) {
		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"mb1", nil, nil, string(VisibilityPrivate), "ollama", "Ollama", "http://l:11434", "llama3.2", nil, nil, nil, string(HealthStatusOK), nil, nil, true, now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)

		list, err := repoOK.ListVisibleTo(ctx, "u1", "hh1")
		if err != nil || len(list) != 1 {
			t.Fatalf("unexpected ListVisibleTo err: %v list: %+v", err, list)
		}
	})
}

func TestNewRepository(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func TestRepository_ErrorBranches(t *testing.T) {
	ctx := context.Background()

	t.Run("Create exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("insert error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.Create(ctx, &ModelBlock{ID: "mb1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Update exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("update error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.Update(ctx, &ModelBlock{ID: "mb1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("Delete exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("delete error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.Delete(ctx, "mb1"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("UpdateHealth exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("update health error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.UpdateHealth(ctx, "mb1", HealthStatusOK, nil, time.Now()); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("ListVisibleTo query error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("query error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if _, err := repo.ListVisibleTo(ctx, "u1", "hh1"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("ListVisibleTo rows iteration error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{err: errors.New("iteration error")}, nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if _, err := repo.ListVisibleTo(ctx, "u1", "hh1"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("HasBootstrapRun scan error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("scan error") }}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.HasBootstrapRun(ctx, "k1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("GetByID scan error (not ErrNoRows)", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("scan error") }}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.GetByID(ctx, "mb1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if errors.Is(err, ErrNotFound) {
			t.Errorf("expected non-ErrNotFound error")
		}
	})

	t.Run("CreateBootstrap begin error", func(t *testing.T) {
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) {
				return nil, errors.New("begin error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.CreateBootstrap(ctx, "k1", &ModelBlock{ID: "mb-boot"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("CreateBootstrap tx exec error", func(t *testing.T) {
		mtx := &mockTx{
			execFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("exec error")
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) { return mtx, nil },
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.CreateBootstrap(ctx, "k1", &ModelBlock{ID: "mb-boot"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
