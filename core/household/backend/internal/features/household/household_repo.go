package household

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (r *repository) CreateHouseholdTx(ctx context.Context, h *Household, ownerEmail, ownerUsername string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start household creation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure the user profile exists JIT to prevent foreign key errors on household_members or households
	_, err = tx.Exec(ctx, ensureUserProfileSQL, h.OwnerID, ownerEmail, ownerUsername)
	if err != nil {
		return fmt.Errorf("failed to ensure user profile exists in transaction: %w", err)
	}

	insertHousehold := `
		INSERT INTO households (id, name, slug, owner_id)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at, updated_at
	`
	err = tx.QueryRow(ctx, insertHousehold, h.ID, h.Name, h.Slug, h.OwnerID).Scan(&h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		if isPgError(err, pgUniqueViolation) { // Unique violation for slug
			return ErrHouseholdSlugExists
		}
		return fmt.Errorf("failed to insert household: %w", err)
	}

	// The first household a user belongs to becomes their default.
	insertOwnerMember := `
		INSERT INTO household_members (household_id, user_id, role, is_default)
		VALUES ($1, $2::varchar, $3, NOT EXISTS (
			SELECT 1 FROM household_members WHERE user_id = $2::varchar AND is_default
		))
	`
	_, err = tx.Exec(ctx, insertOwnerMember, h.ID, h.OwnerID, string(RoleOwner))
	if err != nil {
		return fmt.Errorf("failed to assign owner member in transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit household creation transaction: %w", err)
	}

	return nil
}

func (r *repository) GetHouseholdByID(ctx context.Context, id string) (*Household, error) {
	query := `
		SELECT id, name, slug, owner_id, street, zip, city, country, latitude, longitude, created_at, updated_at
		FROM households
		WHERE id = $1
	`
	h := &Household{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&h.ID, &h.Name, &h.Slug, &h.OwnerID,
		&h.Street, &h.Zip, &h.City, &h.Country, &h.Latitude, &h.Longitude,
		&h.CreatedAt, &h.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || isPgError(err, pgInvalidTextRepresentation) {
			return nil, ErrHouseholdNotFound
		}
		return nil, fmt.Errorf("failed to query household by id %s: %w", id, err)
	}
	return h, nil
}

func (r *repository) GetHouseholdsByUserID(ctx context.Context, userID string) ([]*Household, error) {
	query := `
		SELECT h.id, h.name, h.slug, h.owner_id, h.street, h.zip, h.city, h.country, h.latitude, h.longitude, h.created_at, h.updated_at
		FROM households h
		INNER JOIN household_members hm ON h.id = hm.household_id
		WHERE hm.user_id = $1
		ORDER BY h.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query households for user %s: %w", userID, err)
	}
	defer rows.Close()

	var results []*Household
	for rows.Next() {
		h := &Household{}
		err := rows.Scan(
			&h.ID, &h.Name, &h.Slug, &h.OwnerID,
			&h.Street, &h.Zip, &h.City, &h.Country, &h.Latitude, &h.Longitude,
			&h.CreatedAt, &h.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan household row: %w", err)
		}
		results = append(results, h)
	}

	return results, nil
}

func (r *repository) UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error {
	query := `
		UPDATE households
		SET street = $1, zip = $2, city = $3, country = $4, latitude = $5, longitude = $6, updated_at = NOW()
		WHERE id = $7
	`
	cmd, err := r.db.Exec(ctx, query, street, zip, city, country, latitude, longitude, id)
	if err != nil {
		return fmt.Errorf("failed to update household address: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrHouseholdNotFound
	}
	return nil
}

func (r *repository) RenameHousehold(ctx context.Context, id string, name string) error {
	query := `UPDATE households SET name = $1, updated_at = NOW() WHERE id = $2`
	cmd, err := r.db.Exec(ctx, query, name, id)
	if err != nil {
		return fmt.Errorf("failed to rename household: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrHouseholdNotFound
	}
	return nil
}

// DeleteHousehold removes a household. Members, invites, contact categories
// and contacts are removed by ON DELETE CASCADE foreign keys.
func (r *repository) DeleteHousehold(ctx context.Context, id string) error {
	cmd, err := r.db.Exec(ctx, `DELETE FROM households WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete household: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrHouseholdNotFound
	}
	return nil
}

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
