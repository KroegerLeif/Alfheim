package contact

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
func (m *mockRows) Conn() *pgx.Conn                      { return nil }

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
		case **string:
			if val != nil {
				str := val.(string)
				*d = &str
			} else {
				*d = nil
			}
		case *[]byte:
			if val != nil {
				*d = val.([]byte)
			}
		case *time.Time:
			*d = val.(time.Time)
		}
	}
	return nil
}

func (m *mockRows) Values() ([]any, error) { return nil, nil }
func (m *mockRows) RawValues() [][]byte   { return nil }

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

func TestRepository_Categories(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateCategory error and success", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("err") }}
			},
		}
		repo := newRepositoryWithDB(dbtx)
		if err := repo.CreateCategory(ctx, &ContactCategory{ID: "c1"}); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*time.Time) = now
					*dest[1].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		cat := &ContactCategory{ID: "c1"}
		if err := repoOK.CreateCategory(ctx, cat); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("GetCategories query error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("err")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr)
		if _, err := repoErr.GetCategories(ctx, "hh1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"cat1", "hh1", "Plumbers", "wrench", "#ff0000", now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		cats, err := repoOK.GetCategories(ctx, "hh1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cats) != 1 || cats[0].Name != "Plumbers" {
			t.Errorf("unexpected categories: %+v", cats)
		}
	})

	t.Run("GetCategoryByID ErrCategoryNotFound and success", func(t *testing.T) {
		dbtxNotFound := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNotFound)
		if _, err := repoNF.GetCategoryByID(ctx, "cat999"); !errors.Is(err, ErrCategoryNotFound) {
			t.Errorf("expected ErrCategoryNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "cat1"
					*dest[1].(*string) = "hh1"
					*dest[2].(*string) = "Plumbers"
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		cat, err := repoOK.GetCategoryByID(ctx, "cat1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat.Name != "Plumbers" {
			t.Errorf("unexpected cat: %+v", cat)
		}
	})

	t.Run("UpdateCategory 0 rows affected and success", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.UpdateCategory(ctx, &ContactCategory{ID: "cat1"}); !errors.Is(err, ErrCategoryNotFound) {
			t.Errorf("expected ErrCategoryNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.UpdateCategory(ctx, &ContactCategory{ID: "cat1"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("DeleteCategory 0 rows affected and success", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.DeleteCategory(ctx, "cat1"); !errors.Is(err, ErrCategoryNotFound) {
			t.Errorf("expected ErrCategoryNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.DeleteCategory(ctx, "cat1"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestRepository_Contacts(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateContact error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("err") }}
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr)
		if err := repoErr.CreateContact(ctx, &Contact{ID: "con1"}); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*time.Time) = now
					*dest[1].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.CreateContact(ctx, &Contact{ID: "con1", Links: []string{"http://a.com"}}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("GetContacts error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("err")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr)
		if _, err := repoErr.GetContacts(ctx, "hh1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"con1", "hh1", "cat1", "John", "123", "j@e.com", "Addr", nil, nil, "Desc", []byte(`["http://l1.com"]`), "icon", "avatar", now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		contacts, err := repoOK.GetContacts(ctx, "hh1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(contacts) != 1 || contacts[0].Name != "John" || len(contacts[0].Links) != 1 {
			t.Errorf("unexpected contacts: %+v", contacts)
		}
	})

	t.Run("GetContactByID not found and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetContactByID(ctx, "c999"); !errors.Is(err, ErrContactNotFound) {
			t.Errorf("expected ErrContactNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "con1"
					*dest[1].(*string) = "hh1"
					*dest[3].(*string) = "John"
					*dest[13].(*time.Time) = now
					*dest[14].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		c, err := repoOK.GetContactByID(ctx, "con1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if c.Name != "John" {
			t.Errorf("unexpected contact: %+v", c)
		}
	})

	t.Run("UpdateContact 0 rows affected and success", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.UpdateContact(ctx, &Contact{ID: "c1"}); !errors.Is(err, ErrContactNotFound) {
			t.Errorf("expected ErrContactNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.UpdateContact(ctx, &Contact{ID: "c1"}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("DeleteContact 0 rows affected and success", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.DeleteContact(ctx, "c1"); !errors.Is(err, ErrContactNotFound) {
			t.Errorf("expected ErrContactNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.DeleteContact(ctx, "c1"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestNewRepository(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}
