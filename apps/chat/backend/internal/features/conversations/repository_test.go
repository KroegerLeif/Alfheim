package conversations

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

func TestRepository_Conversations(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateConversation and DeleteConversation success", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("INSERT 0 1"), nil
			},
		}
		repo := newRepositoryWithDB(dbtxOK, nil)
		c := &Conversation{ID: "c1", OwnerUserID: "u1"}
		if err := repo.CreateConversation(ctx, c); err != nil {
			t.Fatalf("unexpected CreateConversation error: %v", err)
		}

		dbtxDel := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 1"), nil
			},
		}
		repoDel := newRepositoryWithDB(dbtxDel, nil)
		if err := repoDel.DeleteConversation(ctx, "c1"); err != nil {
			t.Fatalf("unexpected DeleteConversation error: %v", err)
		}
	})

	t.Run("GetConversationByID ErrNotFound and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF, nil)
		if _, err := repoNF.GetConversationByID(ctx, "c999"); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "c1"
					*dest[1].(*string) = "u1"
					str := "Title"
					*dest[6].(**string) = &str
					*dest[7].(*time.Time) = now
					*dest[8].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK, nil)
		c, err := repoOK.GetConversationByID(ctx, "c1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if c.Title == nil || *c.Title != "Title" {
			t.Errorf("unexpected conversation: %+v", c)
		}
	})

	t.Run("ListConversationsByOwner query error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("err")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr, nil)
		if _, err := repoErr.ListConversationsByOwner(ctx, "u1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"c1", "u1", nil, "app", "ctx", "mb1", "Title 1", now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK, nil)
		list, err := repoOK.ListConversationsByOwner(ctx, "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) != 1 || list[0].Title == nil || *list[0].Title != "Title 1" {
			t.Errorf("unexpected list: %+v", list)
		}
	})
}

func TestRepository_Messages(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateMessage and AppendMessageAndTouchConversation success", func(t *testing.T) {
		mtx := &mockTx{
			execFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) {
				return mtx, nil
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)

		m := &Message{ID: "m1", ConversationID: "c1", Content: "Hello"}
		if err := repo.CreateMessage(ctx, m, "att-1"); err != nil {
			t.Fatalf("unexpected CreateMessage err: %v", err)
		}

		if err := repo.AppendMessageAndTouchConversation(ctx, m); err != nil {
			t.Fatalf("unexpected AppendMessageAndTouchConversation err: %v", err)
		}
	})

	t.Run("ListMessages error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("query err")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr, nil)
		if _, err := repoErr.ListMessages(ctx, "c1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"m1", "c1", "user", "Hello", nil, nil, nil, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK, nil)
		msgs, err := repoOK.ListMessages(ctx, "c1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(msgs) != 1 || msgs[0].Content != "Hello" {
			t.Errorf("unexpected msgs: %+v", msgs)
		}
	})
}

func TestNewRepository(t *testing.T) {
	repo := NewRepository(nil, nil)
	if repo == nil {
		t.Fatal("expected non-nil repository")
	}
}

func TestRepository_ErrorBranches(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateConversation exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("insert error")
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		err := repo.CreateConversation(ctx, &Conversation{ID: "c1"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("GetConversationByID scan error (not ErrNoRows)", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return errors.New("scan error") }}
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		_, err := repo.GetConversationByID(ctx, "c1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if errors.Is(err, ErrNotFound) {
			t.Errorf("expected non-ErrNotFound error, got ErrNotFound")
		}
	})

	t.Run("ListConversationsByOwner rows iteration error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{err: errors.New("iteration error")}, nil
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		_, err := repo.ListConversationsByOwner(ctx, "u1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("DeleteConversation exec error", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("delete error")
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.DeleteConversation(ctx, "c1"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("DeleteConversation 0 rows affected returns ErrNotFound", func(t *testing.T) {
		dbtx := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("DELETE 0"), nil
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.DeleteConversation(ctx, "c1"); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("CreateMessage begin error", func(t *testing.T) {
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) {
				return nil, errors.New("begin error")
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.CreateMessage(ctx, &Message{ID: "m1", ConversationID: "c1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("CreateMessage tx exec error", func(t *testing.T) {
		mtx := &mockTx{
			execFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("tx exec error")
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) { return mtx, nil },
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.CreateMessage(ctx, &Message{ID: "m1", ConversationID: "c1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("ListMessages rows iteration error", func(t *testing.T) {
		dbtx := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{err: errors.New("iteration error")}, nil
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		_, err := repo.ListMessages(ctx, "c1")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("AppendMessageAndTouchConversation begin error", func(t *testing.T) {
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) {
				return nil, errors.New("begin error")
			},
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.AppendMessageAndTouchConversation(ctx, &Message{ID: "m1", ConversationID: "c1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("AppendMessageAndTouchConversation insert error", func(t *testing.T) {
		mtx := &mockTx{
			execFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag(""), errors.New("insert error")
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) { return mtx, nil },
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.AppendMessageAndTouchConversation(ctx, &Message{ID: "m1", ConversationID: "c1"}); err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("AppendMessageAndTouchConversation 0 rows affected returns ErrNotFound", func(t *testing.T) {
		callCount := 0
		mtx := &mockTx{
			execFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
				callCount++
				if callCount == 1 {
					return pgconn.NewCommandTag("INSERT 0 1"), nil
				}
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) { return mtx, nil },
		}
		repo := newRepositoryWithDB(dbtx, nil)
		if err := repo.AppendMessageAndTouchConversation(ctx, &Message{ID: "m1", ConversationID: "c1"}); !errors.Is(err, ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}
