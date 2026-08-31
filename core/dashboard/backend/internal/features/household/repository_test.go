package household

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

type mockTx struct {
	execFunc     func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
	commitErr    error
}

func (m *mockTx) Begin(ctx context.Context) (pgx.Tx, error) { return m, nil }
func (m *mockTx) Commit(ctx context.Context) error          { return m.commitErr }
func (m *mockTx) Rollback(ctx context.Context) error        { return nil }
func (m *mockTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (m *mockTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (m *mockTx) LargeObjects() pgx.LargeObjects                              { return pgx.LargeObjects{} }
func (m *mockTx) Conn() *pgx.Conn                                            { return nil }
func (m *mockTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (m *mockTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if m.execFunc != nil {
		return m.execFunc(ctx, sql, arguments...)
	}
	return pgconn.NewCommandTag(""), nil
}
func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) { return nil, nil }
func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
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

func TestRepository_Households(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateHouseholdTx success", func(t *testing.T) {
		now := time.Now()
		mtx := &mockTx{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*time.Time) = now
					*dest[1].(*time.Time) = now
					return nil
				}}
			},
		}
		dbtx := &mockDBTX{
			beginFunc: func(ctx context.Context) (pgx.Tx, error) {
				return mtx, nil
			},
		}
		repo := newRepositoryWithDB(dbtx)
		h := &Household{ID: "h1", Name: "H1", Slug: "h1", OwnerID: "u1"}
		if err := repo.CreateHouseholdTx(ctx, h, "u1@test.com", "u1"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("GetHouseholdByID not found and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetHouseholdByID(ctx, "h999"); !errors.Is(err, ErrHouseholdNotFound) {
			t.Errorf("expected ErrHouseholdNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "h1"
					*dest[1].(*string) = "H1"
					*dest[2].(*string) = "h1"
					*dest[3].(*string) = "u1"
					*dest[10].(*time.Time) = now
					*dest[11].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		h, err := repoOK.GetHouseholdByID(ctx, "h1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if h.Name != "H1" {
			t.Errorf("unexpected household: %+v", h)
		}
	})

	t.Run("GetHouseholdsByUserID query error and success", func(t *testing.T) {
		dbtxErr := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("err")
			},
		}
		repoErr := newRepositoryWithDB(dbtxErr)
		if _, err := repoErr.GetHouseholdsByUserID(ctx, "u1"); err == nil {
			t.Fatal("expected error, got nil")
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"h1", "H1", "h1", "u1", "st", "1000", "City", "CH", nil, nil, now, now},
					},
				}, nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		list, err := repoOK.GetHouseholdsByUserID(ctx, "u1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(list) != 1 || list[0].Name != "H1" {
			t.Errorf("unexpected list: %+v", list)
		}
	})

	t.Run("UpdateHouseholdAddress 0 rows and success", func(t *testing.T) {
		dbtxZero := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 0"), nil
			},
		}
		repoZero := newRepositoryWithDB(dbtxZero)
		if err := repoZero.UpdateHouseholdAddress(ctx, "h1", "s", "z", "c", "c", nil, nil); !errors.Is(err, ErrHouseholdNotFound) {
			t.Errorf("expected ErrHouseholdNotFound, got %v", err)
		}

		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("UPDATE 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.UpdateHouseholdAddress(ctx, "h1", "s", "z", "c", "c", nil, nil); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestRepository_Invites(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateInvite and IncrementInviteUses success", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("INSERT 0 1"), nil
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		if err := repoOK.CreateInvite(ctx, &Invite{Token: "tok1", Role: RoleMember}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if err := repoOK.IncrementInviteUses(ctx, "tok1"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("GetInviteByToken not found and success", func(t *testing.T) {
		dbtxNF := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error { return pgx.ErrNoRows }}
			},
		}
		repoNF := newRepositoryWithDB(dbtxNF)
		if _, err := repoNF.GetInviteByToken(ctx, "tok999"); !errors.Is(err, ErrInviteNotFound) {
			t.Errorf("expected ErrInviteNotFound, got %v", err)
		}

		now := time.Now()
		dbtxOK := &mockDBTX{
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "tok1"
					*dest[1].(*string) = "h1"
					*dest[2].(*string) = "u1"
					*dest[3].(*string) = "MEMBER"
					*dest[4].(*time.Time) = now
					*dest[5].(*int) = 5
					*dest[6].(*int) = 1
					*dest[7].(*time.Time) = now
					return nil
				}}
			},
		}
		repoOK := newRepositoryWithDB(dbtxOK)
		inv, err := repoOK.GetInviteByToken(ctx, "tok1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inv.Role != RoleMember || inv.MaxUses != 5 {
			t.Errorf("unexpected invite: %+v", inv)
		}
	})
}

func TestRepository_Members(t *testing.T) {
	ctx := context.Background()

	t.Run("AddMember, RemoveMember, UpdateMemberRole, GetMemberRole, GetMembers", func(t *testing.T) {
		dbtxOK := &mockDBTX{
			execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
				return pgconn.NewCommandTag("OK 1"), nil
			},
			queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{scanFunc: func(dest ...any) error {
					*dest[0].(*string) = "ADMIN"
					return nil
				}}
			},
			queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return &mockRows{
					items: [][]any{
						{"h1", "u1", "ADMIN", time.Now(), "u1@e.com", "u1", "U", "1", "http://a.png"},
					},
				}, nil
			},
		}
		repo := newRepositoryWithDB(dbtxOK)

		if err := repo.AddMember(ctx, &Member{HouseholdID: "h1", UserID: "u1", Role: RoleAdmin}); err != nil {
			t.Fatalf("unexpected AddMember err: %v", err)
		}
		if err := repo.UpdateMemberRole(ctx, "h1", "u1", RoleAdmin); err != nil {
			t.Fatalf("unexpected UpdateMemberRole err: %v", err)
		}
		role, err := repo.GetMemberRole(ctx, "h1", "u1")
		if err != nil || role != RoleAdmin {
			t.Fatalf("unexpected GetMemberRole err: %v role: %s", err, role)
		}
		mems, err := repo.GetMembers(ctx, "h1")
		if err != nil || len(mems) != 1 || mems[0].Role != RoleAdmin {
			t.Fatalf("unexpected GetMembers err: %v mems: %+v", err, mems)
		}
		if err := repo.RemoveMember(ctx, "h1", "u1"); err != nil {
			t.Fatalf("unexpected RemoveMember err: %v", err)
		}
	})
}

func TestNewRepository(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}
