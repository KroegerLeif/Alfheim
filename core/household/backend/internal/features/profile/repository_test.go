package profile

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

type mockDBTX struct {
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
	execFunc     func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	queryFunc    func(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func (m *mockDBTX) Begin(ctx context.Context) (pgx.Tx, error) {
	return nil, nil
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
	return nil, nil
}

func (m *mockDBTX) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
	return &mockRow{}
}

func TestRepository_GetByID(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrProfileNotFound when no rows found", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						return pgx.ErrNoRows
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.GetByID(ctx, "nonexistent")
		if !errors.Is(err, ErrProfileNotFound) {
			t.Errorf("expected ErrProfileNotFound, got %v", err)
		}
	})

	t.Run("returns generic error on query error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						return errors.New("db scan error")
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.GetByID(ctx, "err-user")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns profile on success", func(t *testing.T) {
		now := time.Now()
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						*dest[0].(*string) = "p-1"
						*dest[1].(*string) = "test@example.com"
						*dest[2].(*string) = "testuser"
						*dest[3].(*string) = "Test"
						*dest[4].(*string) = "User"
						*dest[5].(*string) = "http://avatar.com"
						*dest[6].(*time.Time) = now
						*dest[7].(*time.Time) = now
						return nil
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		p, err := repo.GetByID(ctx, "p-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.ID != "p-1" || p.Email != "test@example.com" {
			t.Errorf("unexpected profile: %+v", p)
		}
	})
}

func TestRepository_Upsert(t *testing.T) {
	ctx := context.Background()

	t.Run("returns error when exec fails", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.CommandTag{}, errors.New("exec error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.Upsert(ctx, &Profile{ID: "p-1"})
		if err == nil {
			t.Fatal("expected error on failed exec")
		}
	})

	t.Run("succeeds on valid upsert", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("INSERT 0 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.Upsert(ctx, &Profile{ID: "p-1", Email: "e@test.com"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestRepository_Update(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrProfileNotFound when 0 rows affected", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.Update(ctx, &Profile{ID: "p-1"})
		if !errors.Is(err, ErrProfileNotFound) {
			t.Errorf("expected ErrProfileNotFound, got %v", err)
		}
	})

	t.Run("returns error when exec fails", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.CommandTag{}, errors.New("update err")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.Update(ctx, &Profile{ID: "p-1"})
		if err == nil {
			t.Fatal("expected error on failed exec")
		}
	})

	t.Run("succeeds when row updated", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.Update(ctx, &Profile{ID: "p-1", FirstName: "NewName"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestNewRepository(t *testing.T) {
	repo := NewRepository(nil)
	if repo == nil {
		t.Fatal("expected non-nil repository")
	}
}
