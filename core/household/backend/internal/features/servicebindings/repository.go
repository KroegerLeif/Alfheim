package servicebindings

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/go-shared/db"
)

// Repository persists service bindings.
type Repository interface {
	// Upsert creates the binding or replaces its scopes, and reports whether
	// a new row was inserted. CreatedAt is filled in from the database.
	Upsert(ctx context.Context, b *Binding) (created bool, err error)
	// List returns the household's bindings, oldest first.
	List(ctx context.Context, householdID string) ([]Binding, error)
	// Find returns one binding or ErrNotFound.
	Find(ctx context.Context, householdID, principalID string) (Binding, error)
	// Delete removes one binding or returns ErrNotFound.
	Delete(ctx context.Context, householdID, principalID string) error
}

type repository struct {
	db db.DBTX
}

// NewRepository returns the PostgreSQL implementation of Repository.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{db: pool}
}

func newRepositoryWithDB(conn db.DBTX) Repository {
	return &repository{db: conn}
}

func (r *repository) Upsert(ctx context.Context, b *Binding) (bool, error) {
	// xmax is 0 only for a row this statement inserted.
	query := `
		INSERT INTO service_bindings (principal_id, household_id, scopes, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (principal_id, household_id) DO UPDATE SET scopes = EXCLUDED.scopes
		RETURNING created_by, created_at, (xmax = 0) AS inserted
	`
	var created bool
	err := r.db.QueryRow(ctx, query, b.PrincipalID, b.HouseholdID, b.Scopes, b.CreatedBy).
		Scan(&b.CreatedBy, &b.CreatedAt, &created)
	if err != nil {
		return false, fmt.Errorf("failed to save service binding: %w", err)
	}
	return created, nil
}

func (r *repository) List(ctx context.Context, householdID string) ([]Binding, error) {
	query := `
		SELECT principal_id, household_id, scopes, created_by, created_at
		FROM service_bindings
		WHERE household_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to list service bindings: %w", err)
	}
	defer rows.Close()

	bindings := []Binding{}
	for rows.Next() {
		var b Binding
		if err := rows.Scan(&b.PrincipalID, &b.HouseholdID, &b.Scopes, &b.CreatedBy, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to read service binding: %w", err)
		}
		bindings = append(bindings, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to list service bindings: %w", err)
	}
	return bindings, nil
}

func (r *repository) Find(ctx context.Context, householdID, principalID string) (Binding, error) {
	query := `
		SELECT principal_id, household_id, scopes, created_by, created_at
		FROM service_bindings
		WHERE household_id = $1 AND principal_id = $2
	`
	var b Binding
	err := r.db.QueryRow(ctx, query, householdID, principalID).
		Scan(&b.PrincipalID, &b.HouseholdID, &b.Scopes, &b.CreatedBy, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Binding{}, ErrNotFound
	}
	if err != nil {
		return Binding{}, fmt.Errorf("failed to read service binding: %w", err)
	}
	return b, nil
}

func (r *repository) Delete(ctx context.Context, householdID, principalID string) error {
	cmd, err := r.db.Exec(ctx, `DELETE FROM service_bindings WHERE household_id = $1 AND principal_id = $2`, householdID, principalID)
	if err != nil {
		return fmt.Errorf("failed to delete service binding: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
