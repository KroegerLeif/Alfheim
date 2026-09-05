package attachments

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
		case *int64:
			if val != nil {
				*d = val.(int64)
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

func TestRepository_Attachments(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateImageRef and LinkImageRefsToMessage success", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("INSERT 0 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtxOK)
		ref := &ImageRef{ID: "att1", StorageKey: "k1", MimeType: "image/png", SizeBytes: 100}
		if err := repo.CreateImageRef(ctx, ref); err != nil {
			t.Fatalf("unexpected CreateImageRef error: %v", err)
		}

		if err := repo.LinkImageRefsToMessage(ctx, "m1", []string{"att1"}); err != nil {
			t.Fatalf("unexpected LinkImageRefsToMessage error: %v", err)
		}
	})

	t.Run("GetImageRefByID ErrAttachmentNotFound and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetImageRefByID(ctx, "att999"); !errors.Is(err, ErrAttachmentNotFound) {
			t.Errorf("expected ErrAttachmentNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "att1"
					*dest[2].(*string) = "key1"
					*dest[3].(*string) = "image/png"
					*dest[4].(*int64) = 100
					*dest[5].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		ref, err := repoOK.GetImageRefByID(ctx, "att1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ref.StorageKey != "key1" {
			t.Errorf("unexpected ref: %+v", ref)
		}
	})

	t.Run("ListImageRefsByMessageID and ListImageRefsByIDs success", func(t *testing.T) {
		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"att1", nil, "key1", "image/png", int64(100), now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)

		list1, err := repoOK.ListImageRefsByMessageID(ctx, "m1")
		if err != nil || len(list1) != 1 {
			t.Fatalf("unexpected list1 error: %v list: %+v", err, list1)
		}

		list2, err := repoOK.ListImageRefsByIDs(ctx, []string{"att1"})
		if err != nil || len(list2) != 1 {
			t.Fatalf("unexpected list2 error: %v list: %+v", err, list2)
		}
	})

	t.Run("DB error cases and empty inputs", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("exec error")
			},
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("queryRow scan error") }}
			},
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("query error")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr)

		// CreateImageRef error
		if err := repoErr.CreateImageRef(ctx, &ImageRef{ID: "1"}); err == nil {
			t.Errorf("expected CreateImageRef error, got nil")
		}

		// GetImageRefByID error
		if _, err := repoErr.GetImageRefByID(ctx, "1"); err == nil {
			t.Errorf("expected GetImageRefByID error, got nil")
		}

		// ListImageRefsByMessageID query error
		if _, err := repoErr.ListImageRefsByMessageID(ctx, "m1"); err == nil {
			t.Errorf("expected ListImageRefsByMessageID error, got nil")
		}

		// ListImageRefsByIDs empty ids returns empty slice
		listEmpty, err := repoErr.ListImageRefsByIDs(ctx, []string{})
		if err != nil || len(listEmpty) != 0 {
			t.Errorf("expected empty list with no error, got %v list: %v", err, listEmpty)
		}

		// ListImageRefsByIDs query error
		if _, err := repoErr.ListImageRefsByIDs(ctx, []string{"id1"}); err == nil {
			t.Errorf("expected ListImageRefsByIDs error, got nil")
		}

		// LinkImageRefsToMessage empty ids returns nil
		if err := repoErr.LinkImageRefsToMessage(ctx, "m1", []string{}); err != nil {
			t.Errorf("expected nil error on empty ids, got %v", err)
		}

		// LinkImageRefsToMessage exec error
		if err := repoErr.LinkImageRefsToMessage(ctx, "m1", []string{"id1"}); err == nil {
			t.Errorf("expected LinkImageRefsToMessage error, got nil")
		}

		// Rows iteration error
		dbtxIterErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					err: errors.New("iterator error"),
				}, nil
			},
		}
		repoIterErr := newRepositoryWithDB(dbtxIterErr)
		if _, err := repoIterErr.ListImageRefsByMessageID(ctx, "m1"); err == nil {
			t.Errorf("expected iterator error, got nil")
		}
		if _, err := repoIterErr.ListImageRefsByIDs(ctx, []string{"id1"}); err == nil {
			t.Errorf("expected iterator error, got nil")
		}
	})
}

func TestNewRepository(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}
