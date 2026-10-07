package household

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// recordingTx records Exec calls so tests can assert which statements ran.
type recordingTx struct {
	mockTx
	execSQL  []string
	execArgs [][]any
	execErrs map[int]error // Exec call index -> error
	tags     map[int]string
}

func newRecordingTx() *recordingTx {
	tx := &recordingTx{execErrs: map[int]error{}, tags: map[int]string{}}
	tx.mockTx.execFunc = func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
		i := len(tx.execSQL)
		tx.execSQL = append(tx.execSQL, sql)
		tx.execArgs = append(tx.execArgs, args)
		tag, ok := tx.tags[i]
		if !ok {
			tag = "UPDATE 1"
		}
		return pgconn.NewCommandTag(tag), tx.execErrs[i]
	}
	return tx
}

func repoWithTx(tx pgx.Tx) Repository {
	return newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return tx, nil }})
}

func deletedRow(isDefault bool, err error) func(ctx context.Context, sql string, args ...any) pgx.Row {
	return func(ctx context.Context, sql string, args ...any) pgx.Row {
		return &mockRow{scanFunc: func(dest ...any) error {
			if err != nil {
				return err
			}
			*dest[0].(*bool) = isDefault
			return nil
		}}
	}
}

func TestRepository_RemoveMember_ReassignsDefault(t *testing.T) {
	ctx := context.Background()

	t.Run("removing the default membership promotes the next one", func(t *testing.T) {
		tx := newRecordingTx()
		tx.queryRowFunc = deletedRow(true, nil)
		if err := repoWithTx(tx).RemoveMember(ctx, "h1", "u1"); err != nil {
			t.Fatalf("RemoveMember: %v", err)
		}
		if len(tx.execSQL) != 1 || !strings.Contains(tx.execSQL[0], "SET is_default = TRUE") {
			t.Fatalf("expected one promotion statement, got %q", tx.execSQL)
		}
		if !reflect.DeepEqual(tx.execArgs[0], []any{[]string{"u1"}}) {
			t.Fatalf("promotion args = %v", tx.execArgs[0])
		}
	})

	t.Run("removing a non-default membership leaves defaults alone", func(t *testing.T) {
		tx := newRecordingTx()
		tx.queryRowFunc = deletedRow(false, nil)
		if err := repoWithTx(tx).RemoveMember(ctx, "h1", "u1"); err != nil {
			t.Fatalf("RemoveMember: %v", err)
		}
		if len(tx.execSQL) != 0 {
			t.Fatalf("expected no promotion, got %q", tx.execSQL)
		}
	})

	t.Run("error branches", func(t *testing.T) {
		dbErr := errors.New("db")
		notFound := newRecordingTx()
		notFound.queryRowFunc = deletedRow(false, pgx.ErrNoRows)
		if err := repoWithTx(notFound).RemoveMember(ctx, "h1", "u1"); !errors.Is(err, ErrMemberNotFound) {
			t.Errorf("missing member: %v", err)
		}

		failingDelete := newRecordingTx()
		failingDelete.queryRowFunc = deletedRow(false, dbErr)
		if err := repoWithTx(failingDelete).RemoveMember(ctx, "h1", "u1"); !errors.Is(err, dbErr) {
			t.Errorf("delete error: %v", err)
		}

		failingPromote := newRecordingTx()
		failingPromote.queryRowFunc = deletedRow(true, nil)
		failingPromote.execErrs[0] = dbErr
		if err := repoWithTx(failingPromote).RemoveMember(ctx, "h1", "u1"); !errors.Is(err, dbErr) {
			t.Errorf("promotion error: %v", err)
		}

		failingCommit := newRecordingTx()
		failingCommit.queryRowFunc = deletedRow(false, nil)
		failingCommit.commitErr = dbErr
		if err := repoWithTx(failingCommit).RemoveMember(ctx, "h1", "u1"); !errors.Is(err, dbErr) {
			t.Errorf("commit error: %v", err)
		}

		beginErr := newRepositoryWithDB(&mockDBTX{beginFunc: func(ctx context.Context) (pgx.Tx, error) { return nil, dbErr }})
		if err := beginErr.RemoveMember(ctx, "h1", "u1"); !errors.Is(err, dbErr) {
			t.Errorf("begin error: %v", err)
		}
		if err := beginErr.DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("begin error: %v", err)
		}
	})
}

func defaultUsers(ids ...string) func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
		items := make([][]any, len(ids))
		for i, id := range ids {
			items[i] = []any{id}
		}
		return &mockRows{items: items}, nil
	}
}

func TestRepository_DeleteHousehold_ReassignsDefaults(t *testing.T) {
	ctx := context.Background()

	t.Run("members defaulting to the household get a new default", func(t *testing.T) {
		tx := newRecordingTx()
		tx.queryFunc = defaultUsers("u1", "u2")
		if err := repoWithTx(tx).DeleteHousehold(ctx, "h1"); err != nil {
			t.Fatalf("DeleteHousehold: %v", err)
		}
		if len(tx.execSQL) != 2 || !strings.Contains(tx.execSQL[0], "DELETE FROM households") ||
			!strings.Contains(tx.execSQL[1], "SET is_default = TRUE") {
			t.Fatalf("unexpected statements %q", tx.execSQL)
		}
		if !reflect.DeepEqual(tx.execArgs[1], []any{[]string{"u1", "u2"}}) {
			t.Fatalf("promotion args = %v", tx.execArgs[1])
		}
	})

	t.Run("no promotion when nobody defaulted to the household", func(t *testing.T) {
		tx := newRecordingTx()
		tx.tags[0] = "DELETE 1"
		if err := repoWithTx(tx).DeleteHousehold(ctx, "h1"); err != nil {
			t.Fatalf("DeleteHousehold: %v", err)
		}
		if len(tx.execSQL) != 1 {
			t.Fatalf("unexpected statements %q", tx.execSQL)
		}
	})

	t.Run("error branches", func(t *testing.T) {
		dbErr := errors.New("db")

		missing := newRecordingTx()
		missing.tags[0] = "DELETE 0"
		if err := repoWithTx(missing).DeleteHousehold(ctx, "h1"); !errors.Is(err, ErrHouseholdNotFound) {
			t.Errorf("missing household: %v", err)
		}

		queryErr := newRecordingTx()
		queryErr.queryFunc = func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) { return nil, dbErr }
		if err := repoWithTx(queryErr).DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("query error: %v", err)
		}

		scanErr := newRecordingTx()
		scanErr.queryFunc = func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
			return &mockRows{err: dbErr}, nil
		}
		if err := repoWithTx(scanErr).DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("scan error: %v", err)
		}

		deleteErr := newRecordingTx()
		deleteErr.execErrs[0] = dbErr
		if err := repoWithTx(deleteErr).DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("delete error: %v", err)
		}

		promoteErr := newRecordingTx()
		promoteErr.queryFunc = defaultUsers("u1")
		promoteErr.execErrs[1] = dbErr
		if err := repoWithTx(promoteErr).DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("promotion error: %v", err)
		}

		commitErr := newRecordingTx()
		commitErr.commitErr = dbErr
		if err := repoWithTx(commitErr).DeleteHousehold(ctx, "h1"); !errors.Is(err, dbErr) {
			t.Errorf("commit error: %v", err)
		}
	})
}
