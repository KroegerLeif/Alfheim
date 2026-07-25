package profile

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository defines data access operations for user profiles.
type Repository interface {
	GetByID(ctx context.Context, id string) (*Profile, error)
	Upsert(ctx context.Context, profile *Profile) error
	Update(ctx context.Context, profile *Profile) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes a PostgreSQL-backed profile repository.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) GetByID(ctx context.Context, id string) (*Profile, error) {
	query := `
		SELECT id, email, username, first_name, last_name, avatar_url, created_at, updated_at
		FROM user_profiles
		WHERE id = $1
	`

	p := &Profile{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID,
		&p.Email,
		&p.Username,
		&p.FirstName,
		&p.LastName,
		&p.AvatarURL,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("failed to query profile by id %s: %w", id, err)
	}

	return p, nil
}

func (r *repository) Upsert(ctx context.Context, profile *Profile) error {
	query := `
		INSERT INTO user_profiles (id, email, username, first_name, last_name, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			username = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			updated_at = NOW()
	`

	now := time.Now()
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = now
	}
	profile.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		profile.ID,
		profile.Email,
		profile.Username,
		profile.FirstName,
		profile.LastName,
		profile.AvatarURL,
		profile.CreatedAt,
		profile.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to upsert user profile %s: %w", profile.ID, err)
	}

	return nil
}

func (r *repository) Update(ctx context.Context, profile *Profile) error {
	query := `
		UPDATE user_profiles
		SET first_name = $1, last_name = $2, avatar_url = $3, updated_at = NOW()
		WHERE id = $4
	`

	res, err := r.pool.Exec(ctx, query, profile.FirstName, profile.LastName, profile.AvatarURL, profile.ID)
	if err != nil {
		return fmt.Errorf("failed to update user profile %s: %w", profile.ID, err)
	}

	if res.RowsAffected() == 0 {
		return ErrProfileNotFound
	}

	return nil
}
