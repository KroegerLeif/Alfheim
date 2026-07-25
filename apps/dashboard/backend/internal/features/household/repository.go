package household

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository persistence contract for household entities.
type Repository interface {
	Create(ctx context.Context, h *Household) error
	GetByID(ctx context.Context, id string) (*Household, error)
	GetByUserID(ctx context.Context, userID string) ([]*Household, error)
	AddMember(ctx context.Context, m *Member) error
	GetMemberRole(ctx context.Context, householdID, userID string) (HouseholdRole, error)
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes PostgreSQL-backed repository for households.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) Create(ctx context.Context, h *Household) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start household creation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	insertHousehold := `
		INSERT INTO households (name, slug, owner_id)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(ctx, insertHousehold, h.Name, h.Slug, h.OwnerID).Scan(&h.ID, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert household: %w", err)
	}

	insertOwnerMember := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
	`
	_, err = tx.Exec(ctx, insertOwnerMember, h.ID, h.OwnerID, string(RoleOwner))
	if err != nil {
		return fmt.Errorf("failed to assign owner member: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit household transaction: %w", err)
	}

	return nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*Household, error) {
	query := `
		SELECT id, name, slug, owner_id, created_at, updated_at
		FROM households
		WHERE id = $1
	`
	h := &Household{}
	err := r.pool.QueryRow(ctx, query, id).Scan(&h.ID, &h.Name, &h.Slug, &h.OwnerID, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrHouseholdNotFound
		}
		return nil, fmt.Errorf("failed to query household by id %s: %w", id, err)
	}
	return h, nil
}

func (r *repository) GetByUserID(ctx context.Context, userID string) ([]*Household, error) {
	query := `
		SELECT h.id, h.name, h.slug, h.owner_id, h.created_at, h.updated_at
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
		if err := rows.Scan(&h.ID, &h.Name, &h.Slug, &h.OwnerID, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan household row: %w", err)
		}
		results = append(results, h)
	}

	return results, nil
}

func (r *repository) AddMember(ctx context.Context, m *Member) error {
	query := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
	`
	_, err := r.pool.Exec(ctx, query, m.HouseholdID, m.UserID, string(m.Role))
	if err != nil {
		return fmt.Errorf("failed to add member to household: %w", err)
	}
	return nil
}

func (r *repository) GetMemberRole(ctx context.Context, householdID, userID string) (HouseholdRole, error) {
	query := `
		SELECT role
		FROM household_members
		WHERE household_id = $1 AND user_id = $2
	`
	var roleStr string
	err := r.pool.QueryRow(ctx, query, householdID, userID).Scan(&roleStr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrUnauthorizedHouseholdAccess
		}
		return "", fmt.Errorf("failed to query member role: %w", err)
	}
	return HouseholdRole(roleStr), nil
}
