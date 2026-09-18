package household

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func execTag(tag string, err error) func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
		return pgconn.NewCommandTag(tag), err
	}
}

func TestRepository_RenameAndDelete(t *testing.T) {
	ctx := context.Background()
	dbErr := errors.New("db")

	ok := newRepositoryWithDB(&mockDBTX{execFunc: execTag("UPDATE 1", nil)})
	if err := ok.RenameHousehold(ctx, "h1", "n"); err != nil {
		t.Errorf("rename: %v", err)
	}
	if err := ok.DeleteHousehold(ctx, "h1"); err != nil {
		t.Errorf("delete: %v", err)
	}
	zero := newRepositoryWithDB(&mockDBTX{execFunc: execTag("UPDATE 0", nil)})
	if err := zero.RenameHousehold(ctx, "h1", "n"); !errors.Is(err, ErrHouseholdNotFound) {
		t.Errorf("rename 0 rows: %v", err)
	}
	if err := zero.DeleteHousehold(ctx, "h1"); !errors.Is(err, ErrHouseholdNotFound) {
		t.Errorf("delete 0 rows: %v", err)
	}
	if err := zero.DeleteInvite(ctx, "h1", "t"); !errors.Is(err, ErrInviteNotFound) {
		t.Errorf("delete invite 0 rows: %v", err)
	}
	if err := ok.DeleteInvite(ctx, "h1", "t"); err != nil {
		t.Errorf("delete invite: %v", err)
	}
	bad := newRepositoryWithDB(&mockDBTX{execFunc: execTag("", dbErr)})
	if err := bad.RenameHousehold(ctx, "h1", "n"); !errors.Is(err, dbErr) {
		t.Errorf("rename err: %v", err)
	}
	if err := bad.DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
		t.Errorf("delete err: %v", err)
	}
	if err := bad.DeleteInvite(ctx, "h1", "t"); !errors.Is(err, dbErr) {
		t.Errorf("delete invite err: %v", err)
	}
}

func TestRepository_DefaultHousehold(t *testing.T) {
	ctx := context.Background()

	none := newRepositoryWithDB(&mockDBTX{})
	if id, err := none.GetDefaultHouseholdID(ctx, "u"); err != nil || id != "" {
		t.Errorf("no default: %q, %v", id, err)
	}
	found := newRepositoryWithDB(&mockDBTX{queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
		return &mockRow{scanFunc: func(dest ...any) error { *dest[0].(*string) = "h1"; return nil }}
	}})
	if id, err := found.GetDefaultHouseholdID(ctx, "u"); err != nil || id != "h1" {
		t.Errorf("default: %q, %v", id, err)
	}
	failing := newRepositoryWithDB(&mockDBTX{queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
		return &mockRow{scanFunc: func(dest ...any) error { return errors.New("db") }}
	}})
	if _, err := failing.GetDefaultHouseholdID(ctx, "u"); err == nil {
		t.Error("expected error")
	}

	withTx := func(tx *mockTx) Repository {
		return newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }})
	}
	if err := withTx(&mockTx{execFunc: execTag("UPDATE 1", nil)}).SetDefaultHouseholdTx(ctx, "u", "h1"); err != nil {
		t.Errorf("set default: %v", err)
	}
	if err := withTx(&mockTx{execFunc: execTag("UPDATE 0", nil)}).SetDefaultHouseholdTx(ctx, "u", "h1"); !errors.Is(err, ErrUnauthorizedHouseholdAccess) {
		t.Errorf("set default non-member: %v", err)
	}
	if err := withTx(&mockTx{execFunc: execTag("", errors.New("db"))}).SetDefaultHouseholdTx(ctx, "u", "h1"); err == nil {
		t.Error("expected exec error")
	}
	if err := withTx(&mockTx{execFunc: execTag("UPDATE 1", nil), commitErr: errors.New("c")}).SetDefaultHouseholdTx(ctx, "u", "h1"); err == nil {
		t.Error("expected commit error")
	}
	beginErr := newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return nil, errors.New("b") }})
	if err := beginErr.SetDefaultHouseholdTx(ctx, "u", "h1"); err == nil {
		t.Error("expected begin error")
	}
	if err := beginErr.TransferOwnershipTx(ctx, "h1", "a", "b"); err == nil {
		t.Error("expected begin error")
	}
	if _, err := beginErr.RedeemInviteTx(ctx, "t", "u", "", ""); err == nil {
		t.Error("expected begin error")
	}
}

func TestRepository_TransferOwnershipTx(t *testing.T) {
	ctx := context.Background()
	run := func(tags []string, commitErr error) error {
		i := 0
		tx := &mockTx{commitErr: commitErr, execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			tag := tags[i]
			i++
			if tag == "ERR" {
				return pgconn.NewCommandTag(""), errors.New("db")
			}
			return pgconn.NewCommandTag(tag), nil
		}}
		return newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}).
			TransferOwnershipTx(ctx, "h1", "old", "new")
	}
	if err := run([]string{"UPDATE 1", "UPDATE 1", "UPDATE 1"}, nil); err != nil {
		t.Errorf("success: %v", err)
	}
	if err := run([]string{"UPDATE 0"}, nil); !errors.Is(err, ErrUnauthorizedHouseholdAccess) {
		t.Errorf("not owner: %v", err)
	}
	if err := run([]string{"UPDATE 1", "UPDATE 0"}, nil); !errors.Is(err, ErrMemberNotFound) {
		t.Errorf("target missing: %v", err)
	}
	if err := run([]string{"UPDATE 1", "UPDATE 1", "UPDATE 0"}, nil); !errors.Is(err, ErrHouseholdNotFound) {
		t.Errorf("household missing: %v", err)
	}
	for _, tags := range [][]string{{"ERR"}, {"UPDATE 1", "ERR"}, {"UPDATE 1", "UPDATE 1", "ERR"}} {
		if err := run(tags, nil); err == nil {
			t.Errorf("%v: expected error", tags)
		}
	}
	if err := run([]string{"UPDATE 1", "UPDATE 1", "UPDATE 1"}, errors.New("c")); err == nil {
		t.Error("expected commit error")
	}
}

func TestRepository_ListActiveInvites(t *testing.T) {
	ctx := context.Background()
	now := time.Now()
	ok := newRepositoryWithDB(&mockDBTX{queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
		return &mockRows{items: [][]any{{"t1", "h1", "u1", "MEMBER", now, 2, 0, now}}}, nil
	}})
	list, err := ok.ListActiveInvites(ctx, "h1")
	if err != nil || len(list) != 1 || list[0].Token != "t1" || list[0].Role != RoleMember {
		t.Errorf("list: %+v, %v", list, err)
	}
	empty := newRepositoryWithDB(&mockDBTX{})
	if list, err := empty.ListActiveInvites(ctx, "h1"); err != nil || list == nil || len(list) != 0 {
		t.Errorf("empty list must be non-nil: %+v, %v", list, err)
	}
	qErr := newRepositoryWithDB(&mockDBTX{queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
		return nil, errors.New("db")
	}})
	if _, err := qErr.ListActiveInvites(ctx, "h1"); err == nil {
		t.Error("expected query error")
	}
	rowsErr := newRepositoryWithDB(&mockDBTX{queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
		return &mockRows{err: errors.New("iter")}, nil
	}})
	if _, err := rowsErr.ListActiveInvites(ctx, "h1"); err == nil {
		t.Error("expected iteration error")
	}
}

func TestRepository_RedeemInviteTx(t *testing.T) {
	ctx := context.Background()
	now := time.Now()
	inviteRow := func(role string) func(dest ...any) error {
		return func(dest ...any) error {
			*dest[0].(*string) = "tok"
			*dest[1].(*string) = "h1"
			*dest[2].(*string) = "inviter"
			*dest[3].(*string) = role
			*dest[4].(*time.Time) = now.Add(time.Hour)
			*dest[5].(*int) = 1
			*dest[6].(*int) = 1
			*dest[7].(*time.Time) = now
			return nil
		}
	}
	redeem := func(tx *mockTx) (*Invite, error) {
		return newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }}).
			RedeemInviteTx(ctx, "tok", "u", "", "")
	}
	updateThen := func(update func(dest ...any) error, exists bool, existsErr error) func(ctx context.Context, sql string, args ...any) pgx.Row {
		return func(ctx context.Context, sql string, args ...any) pgx.Row {
			if strings.Contains(sql, "UPDATE household_invites") {
				return &mockRow{scanFunc: update}
			}
			return &mockRow{scanFunc: func(dest ...any) error {
				if existsErr != nil {
					return existsErr
				}
				*dest[0].(*bool) = exists
				return nil
			}}
		}
	}

	inv, err := redeem(&mockTx{queryRowFunc: updateThen(inviteRow("GUEST"), false, nil)})
	if err != nil || inv.Role != RoleGuest || inv.HouseholdID != "h1" {
		t.Errorf("success: %+v, %v", inv, err)
	}
	inv, err = redeem(&mockTx{queryRowFunc: updateThen(inviteRow("OWNER"), false, nil)})
	if err != nil || inv.Role != RoleMember {
		t.Errorf("OWNER invite must redeem as MEMBER: %+v, %v", inv, err)
	}
	noRows := func(dest ...any) error { return pgx.ErrNoRows }
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(noRows, true, nil)}); !errors.Is(err, ErrInviteExpiredOrInvalid) {
		t.Errorf("used up: %v", err)
	}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(noRows, false, nil)}); !errors.Is(err, ErrInviteNotFound) {
		t.Errorf("unknown: %v", err)
	}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(noRows, false, errors.New("db"))}); err == nil {
		t.Error("expected lookup error")
	}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(func(dest ...any) error { return errors.New("db") }, false, nil)}); err == nil {
		t.Error("expected update error")
	}

	calls := 0
	memberInsert := func(err error) func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
		return func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			calls++
			if strings.Contains(sql, "INSERT INTO household_members") {
				return pgconn.NewCommandTag(""), err
			}
			return pgconn.NewCommandTag("INSERT 0 1"), nil
		}
	}
	dup := &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "household_members_pkey"}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(inviteRow("MEMBER"), false, nil), execFunc: memberInsert(dup)}); !errors.Is(err, ErrMemberAlreadyExists) {
		t.Errorf("already member: %v", err)
	}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(inviteRow("MEMBER"), false, nil), execFunc: memberInsert(errors.New("db"))}); err == nil || errors.Is(err, ErrMemberAlreadyExists) {
		t.Errorf("insert error: %v", err)
	}
	profileErr := &mockTx{execFunc: execTag("", errors.New("db"))}
	if _, err := redeem(profileErr); err == nil {
		t.Error("expected profile error")
	}
	if _, err := redeem(&mockTx{queryRowFunc: updateThen(inviteRow("MEMBER"), false, nil), commitErr: errors.New("c")}); err == nil {
		t.Error("expected commit error")
	}
	if calls == 0 {
		t.Error("member insert never exercised")
	}
}

func TestRepository_NonUUIDMapping(t *testing.T) {
	ctx := context.Background()
	badUUID := &pgconn.PgError{Code: pgInvalidTextRepresentation}
	repo := newRepositoryWithDB(&mockDBTX{queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
		return &mockRow{scanFunc: func(dest ...any) error { return badUUID }}
	}})
	if _, err := repo.GetMemberRole(ctx, "x", "u"); !errors.Is(err, ErrUnauthorizedHouseholdAccess) {
		t.Errorf("GetMemberRole: %v", err)
	}
	if _, err := repo.GetHouseholdByID(ctx, "x"); !errors.Is(err, ErrHouseholdNotFound) {
		t.Errorf("GetHouseholdByID: %v", err)
	}
}
