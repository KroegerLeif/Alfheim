package household

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const inviteColumns = `token, household_id, inviter_id, role, expires_at, max_uses, uses, created_at`

func scanInvite(row pgx.Row) (*Invite, error) {
	i := &Invite{}
	var roleStr string
	if err := row.Scan(
		&i.Token,
		&i.HouseholdID,
		&i.InviterID,
		&roleStr,
		&i.ExpiresAt,
		&i.MaxUses,
		&i.Uses,
		&i.CreatedAt,
	); err != nil {
		return nil, err
	}
	i.Role = HouseholdRole(roleStr)
	return i, nil
}

func (r *repository) CreateInvite(ctx context.Context, invite *Invite) error {
	query := `
		INSERT INTO household_invites (` + inviteColumns + `)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if invite.CreatedAt.IsZero() {
		invite.CreatedAt = time.Now()
	}
	_, err := r.db.Exec(ctx, query,
		invite.Token,
		invite.HouseholdID,
		invite.InviterID,
		string(invite.Role),
		invite.ExpiresAt,
		invite.MaxUses,
		invite.Uses,
		invite.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert household invite token: %w", err)
	}
	return nil
}

// ListActiveInvites returns the household's invites that are neither expired nor used up.
func (r *repository) ListActiveInvites(ctx context.Context, householdID string) ([]*Invite, error) {
	query := `
		SELECT ` + inviteColumns + `
		FROM household_invites
		WHERE household_id = $1 AND expires_at > NOW() AND uses < max_uses
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to query household invites: %w", err)
	}
	defer rows.Close()

	invites := []*Invite{}
	for rows.Next() {
		inv, err := scanInvite(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan invite row: %w", err)
		}
		invites = append(invites, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate invite rows: %w", err)
	}
	return invites, nil
}

// DeleteInvite revokes an invite, scoped to its household.
func (r *repository) DeleteInvite(ctx context.Context, householdID string, token string) error {
	cmd, err := r.db.Exec(ctx, `DELETE FROM household_invites WHERE token = $1 AND household_id = $2`, token, householdID)
	if err != nil {
		return fmt.Errorf("failed to delete invite: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrInviteNotFound
	}
	return nil
}

// RedeemInviteTx atomically consumes one use of an invite and adds the user as
// a member, in a single transaction.
//
// The conditional UPDATE takes a row lock, so concurrent redemptions of the
// same token serialise on it and re-check "uses < max_uses" after the winner
// commits: a max_uses=1 invite admits exactly one member. If the user is
// already a member the whole transaction rolls back (the use is not consumed)
// and ErrMemberAlreadyExists is returned. The member role is the invite's role,
// but never OWNER.
func (r *repository) RedeemInviteTx(ctx context.Context, token, userID, email, username string) (*Invite, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start invite redemption transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, ensureUserProfileSQL, userID, email, username); err != nil {
		return nil, fmt.Errorf("failed to ensure user profile exists in transaction: %w", err)
	}

	invite, err := scanInvite(tx.QueryRow(ctx, `
		UPDATE household_invites
		SET uses = uses + 1
		WHERE token = $1 AND uses < max_uses AND expires_at > NOW()
		RETURNING `+inviteColumns, token))
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("failed to consume invite: %w", err)
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM household_invites WHERE token = $1)`, token).Scan(&exists); err != nil {
			return nil, fmt.Errorf("failed to look up invite: %w", err)
		}
		if exists {
			return nil, ErrInviteExpiredOrInvalid
		}
		return nil, ErrInviteNotFound
	}

	role, err := ParseRole(string(invite.Role))
	if err != nil || role == RoleOwner {
		role = RoleMember
	}
	invite.Role = role

	_, err = tx.Exec(ctx, `
		INSERT INTO household_members (household_id, user_id, role, is_default)
		VALUES ($1, $2::varchar, $3, NOT EXISTS (
			SELECT 1 FROM household_members WHERE user_id = $2::varchar AND is_default
		))
	`, invite.HouseholdID, userID, string(role))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation && pgErr.ConstraintName == "household_members_pkey" {
			return nil, ErrMemberAlreadyExists
		}
		return nil, fmt.Errorf("failed to add member to household: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit invite redemption: %w", err)
	}
	return invite, nil
}
