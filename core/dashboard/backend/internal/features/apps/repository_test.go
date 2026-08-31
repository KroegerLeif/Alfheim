package apps

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

func (m *mockRows) Close()                               {}
func (m *mockRows) Err() error                           { return m.err }
func (m *mockRows) CommandTag() pgconn.CommandTag        { return pgconn.NewCommandTag("") }
func (m *mockRows) FieldDescriptions() []pgconn.FieldDescription { return nil }

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
			*d = val.(string)
		case *int:
			*d = val.(int)
		case *time.Time:
			*d = val.(time.Time)
		}
	}
	return nil
}

func (m *mockRows) Values() ([]any, error) { return nil, nil }
func (m *mockRows) RawValues() [][]byte   { return nil }
func (m *mockRows) Conn() *pgx.Conn       { return nil }

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
	return &mockRows{}, nil
}

func (m *mockDBTX) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
	return &mockRow{}
}

func TestRepository_GetUserPreferences(t *testing.T) {
	ctx := context.Background()

	t.Run("returns empty default preferences when no row found", func(t *testing.T) {
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
		pref, err := repo.GetUserPreferences(ctx, "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if pref.UserID != "u1" || len(pref.HiddenAppIDs) != 0 {
			t.Errorf("expected empty preferences for u1, got %+v", pref)
		}
	})

	t.Run("returns error on query error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						return errors.New("db error")
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.GetUserPreferences(ctx, "u1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns user preferences on success", func(t *testing.T) {
		now := time.Now()
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						*dest[0].(*string) = "u1"
						*dest[1].(*[]string) = []string{"app-1"}
						*dest[2].(*time.Time) = now
						*dest[3].(*time.Time) = now
						return nil
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		pref, err := repo.GetUserPreferences(ctx, "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(pref.HiddenAppIDs) != 1 || pref.HiddenAppIDs[0] != "app-1" {
			t.Errorf("unexpected pref: %+v", pref)
		}
	})
}

func TestRepository_UpdateUserPreferences(t *testing.T) {
	ctx := context.Background()

	t.Run("returns error on upsert failure", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						return errors.New("upsert error")
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.UpdateUserPreferences(ctx, "u1", nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns updated preferences", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						*dest[0].(*string) = "u1"
						*dest[1].(*[]string) = []string{"app-2"}
						return nil
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		pref, err := repo.UpdateUserPreferences(ctx, "u1", []string{"app-2"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(pref.HiddenAppIDs) != 1 || pref.HiddenAppIDs[0] != "app-2" {
			t.Errorf("unexpected pref: %+v", pref)
		}
	})
}

func TestRepository_GetUserLinks(t *testing.T) {
	ctx := context.Background()

	t.Run("returns query error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("query error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		_, err := repo.GetUserLinks(ctx, "u1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns scanned user links", func(t *testing.T) {
		now := time.Now()
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"l1", "u1", "Title 1", "https://url1.com", "icon1", "cat1", "desc1", 1, now, now},
					},
				}, nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		links, err := repo.GetUserLinks(ctx, "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(links) != 1 || links[0].Title != "Title 1" {
			t.Errorf("unexpected links: %+v", links)
		}
	})
}

func TestRepository_GetUserLinkByID(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrLinkNotFound when no row found", func(t *testing.T) {
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
		_, err := repo.GetUserLinkByID(ctx, "l999", "u1")
		if !errors.Is(err, ErrLinkNotFound) {
			t.Errorf("expected ErrLinkNotFound, got %v", err)
		}
	})

	t.Run("returns user link on success", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						*dest[0].(*string) = "l1"
						*dest[1].(*string) = "u1"
						*dest[2].(*string) = "Link 1"
						return nil
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		link, err := repo.GetUserLinkByID(ctx, "l1", "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if link.ID != "l1" || link.Title != "Link 1" {
			t.Errorf("unexpected link: %+v", link)
		}
	})
}

func TestRepository_CreateUserLink(t *testing.T) {
	ctx := context.Background()

	t.Run("returns error on insert failure", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						return errors.New("insert error")
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.CreateUserLink(ctx, &UserLink{UserID: "u1"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns created user link with ID", func(t *testing.T) {
		now := time.Now()
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						*dest[0].(*string) = "new-link-id"
						*dest[1].(*time.Time) = now
						*dest[2].(*time.Time) = now
						return nil
					},
				}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		link := &UserLink{UserID: "u1", Title: "New"}
		err := repo.CreateUserLink(ctx, link)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if link.ID != "new-link-id" {
			t.Errorf("expected ID new-link-id, got %s", link.ID)
		}
	})
}

func TestRepository_UpdateUserLink(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrLinkNotFound when 0 rows affected", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.UpdateUserLink(ctx, &UserLink{ID: "l1", UserID: "u1"})
		if !errors.Is(err, ErrLinkNotFound) {
			t.Errorf("expected ErrLinkNotFound, got %v", err)
		}
	})

	t.Run("succeeds when updated", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.UpdateUserLink(ctx, &UserLink{ID: "l1", UserID: "u1"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestRepository_DeleteUserLink(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrLinkNotFound when 0 rows affected", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 0"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.DeleteUserLink(ctx, "l1", "u1")
		if !errors.Is(err, ErrLinkNotFound) {
			t.Errorf("expected ErrLinkNotFound, got %v", err)
		}
	})

	t.Run("returns error when exec fails", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.CommandTag{}, errors.New("delete error")
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.DeleteUserLink(ctx, "l1", "u1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("succeeds when deleted", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		err := repo.DeleteUserLink(ctx, "l1", "u1")
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
