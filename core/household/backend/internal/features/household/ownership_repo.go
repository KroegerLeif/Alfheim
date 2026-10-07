package household

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// TransferOwnershipTx makes toUserID the OWNER and demotes fromUserID to ADMIN
// in one transaction. The demotion runs first so the one-owner-per-household
// unique index is never violated mid-transaction.
func (r *repository) TransferOwnershipTx(ctx context.Context, householdID, fromUserID, toUserID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start ownership transfer transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	cmd, err := tx.Exec(ctx, `
		UPDATE household_members SET role = $3
		WHERE household_id = $1 AND user_id = $2 AND role = $4
	`, householdID, fromUserID, string(RoleAdmin), string(RoleOwner))
	if err != nil {
		return fmt.Errorf("failed to demote previous owner: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrUnauthorizedHouseholdAccess
	}

	cmd, err = tx.Exec(ctx, `
		UPDATE household_members SET role = $3
		WHERE household_id = $1 AND user_id = $2
	`, householdID, toUserID, string(RoleOwner))
	if err != nil {
		return fmt.Errorf("failed to promote new owner: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrMemberNotFound
	}

	cmd, err = tx.Exec(ctx, `UPDATE households SET owner_id = $2, updated_at = NOW() WHERE id = $1`, householdID, toUserID)
	if err != nil {
		return fmt.Errorf("failed to update household owner: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrHouseholdNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit ownership transfer: %w", err)
	}
	return nil
}

// GetDefaultHouseholdID returns the caller's default household id, or "" if none is set.
func (r *repository) GetDefaultHouseholdID(ctx context.Context, userID string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		SELECT household_id FROM household_members WHERE user_id = $1 AND is_default
	`, userID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("failed to query default household: %w", err)
	}
	return id, nil
}

// SetDefaultHouseholdTx marks householdID as the user's only default household.
func (r *repository) SetDefaultHouseholdTx(ctx context.Context, userID, householdID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start default household transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE household_members SET is_default = FALSE
		WHERE user_id = $1 AND is_default AND household_id <> $2
	`, userID, householdID); err != nil {
		return fmt.Errorf("failed to clear previous default household: %w", err)
	}

	cmd, err := tx.Exec(ctx, `
		UPDATE household_members SET is_default = TRUE
		WHERE user_id = $1 AND household_id = $2
	`, userID, householdID)
	if err != nil {
		return fmt.Errorf("failed to set default household: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrUnauthorizedHouseholdAccess
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit default household change: %w", err)
	}
	return nil
}
