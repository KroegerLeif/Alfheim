package household

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (r *repository) CreateHouseholdTx(ctx context.Context, h *Household, ownerEmail, ownerUsername string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start household creation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure the user profile exists JIT to prevent foreign key errors on household_members or households
	ensureUserProfile := `
		INSERT INTO user_profiles (id, email, username, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, err = tx.Exec(ctx, ensureUserProfile, h.OwnerID, ownerEmail, ownerUsername)
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
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // Unique violation for slug
			return ErrHouseholdSlugExists
		}
		return fmt.Errorf("failed to insert household: %w", err)
	}

	insertOwnerMember := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
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
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&h.ID, &h.Name, &h.Slug, &h.OwnerID,
		&h.Street, &h.Zip, &h.City, &h.Country, &h.Latitude, &h.Longitude,
		&h.CreatedAt, &h.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
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
	rows, err := r.pool.Query(ctx, query, userID)
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
	cmd, err := r.pool.Exec(ctx, query, street, zip, city, country, latitude, longitude, id)
	if err != nil {
		return fmt.Errorf("failed to update household address: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrHouseholdNotFound
	}
	return nil
}
