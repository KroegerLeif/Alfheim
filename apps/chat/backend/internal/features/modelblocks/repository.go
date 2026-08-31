package modelblocks

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/chat/internal/shared/db"
)

// Repository defines data access operations for model blocks.
type Repository interface {
	Create(ctx context.Context, m *ModelBlock) error
	GetByID(ctx context.Context, id string) (*ModelBlock, error)
	// ListVisibleTo returns every model block owned by userID, plus every model
	// block shared within householdID (householdID may be empty).
	ListVisibleTo(ctx context.Context, userID, householdID string) ([]*ModelBlock, error)
	Update(ctx context.Context, m *ModelBlock) error
	Delete(ctx context.Context, id string) error
	UpdateHealth(ctx context.Context, id string, status HealthStatus, detail *string, checkedAt time.Time) error

	// HasBootstrapRun reports whether the one-time ENV-seeded bootstrap model block
	// has already been created, identified by an application-defined key.
	HasBootstrapRun(ctx context.Context, key string) (bool, error)
	// CreateBootstrap inserts the bootstrap model block and marks the bootstrap key
	// as applied in a single transaction, so the two states can never diverge.
	CreateBootstrap(ctx context.Context, key string, m *ModelBlock) error
}

type repository struct {
	db db.DBTX
}

// NewRepository initializes a PostgreSQL-backed model block repository.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{db: pool}
}

func newRepositoryWithDB(db db.DBTX) Repository {
	return &repository{db: db}
}

const modelBlockColumns = `
	id, owner_user_id, household_id, visibility, provider_type, display_name, base_url,
	model_identifier, api_key_encrypted, api_key_key_id, config_json, health_status,
	health_checked_at, health_detail, is_bootstrap, created_at, updated_at
`

func scanModelBlock(row pgx.Row) (*ModelBlock, error) {
	m := &ModelBlock{}
	err := row.Scan(
		&m.ID, &m.OwnerUserID, &m.HouseholdID, &m.Visibility, &m.ProviderType, &m.DisplayName, &m.BaseURL,
		&m.ModelIdentifier, &m.APIKeyEncrypted, &m.APIKeyKeyID, &m.ConfigJSON, &m.HealthStatus,
		&m.HealthCheckedAt, &m.HealthDetail, &m.IsBootstrap, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *repository) Create(ctx context.Context, m *ModelBlock) error {
	query := `
		INSERT INTO model_blocks (
			id, owner_user_id, household_id, visibility, provider_type, display_name, base_url,
			model_identifier, api_key_encrypted, api_key_key_id, config_json, health_status,
			is_bootstrap, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	now := time.Now()
	m.CreatedAt = now
	m.UpdatedAt = now

	_, err := r.db.Exec(ctx, query,
		m.ID, m.OwnerUserID, m.HouseholdID, m.Visibility, m.ProviderType, m.DisplayName, m.BaseURL,
		m.ModelIdentifier, m.APIKeyEncrypted, m.APIKeyKeyID, m.ConfigJSON, m.HealthStatus,
		m.IsBootstrap, m.CreatedAt, m.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert model block %s: %w", m.ID, err)
	}
	return nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*ModelBlock, error) {
	query := `SELECT` + modelBlockColumns + `FROM model_blocks WHERE id = $1`

	m, err := scanModelBlock(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query model block %s: %w", id, err)
	}
	return m, nil
}

func (r *repository) ListVisibleTo(ctx context.Context, userID, householdID string) ([]*ModelBlock, error) {
	query := `
		SELECT` + modelBlockColumns + `FROM model_blocks
		WHERE owner_user_id = $1
		   OR (visibility = 'shared' AND household_id = $2 AND $2 != '')
		   OR is_bootstrap = TRUE
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query, userID, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to list model blocks visible to user %s: %w", userID, err)
	}
	defer rows.Close()

	var results []*ModelBlock
	for rows.Next() {
		m, err := scanModelBlock(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan model block row: %w", err)
		}
		results = append(results, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate model block rows: %w", err)
	}
	return results, nil
}

func (r *repository) Update(ctx context.Context, m *ModelBlock) error {
	query := `
		UPDATE model_blocks SET
			display_name = $1,
			base_url = $2,
			model_identifier = $3,
			api_key_encrypted = $4,
			api_key_key_id = $5,
			visibility = $6,
			household_id = $7,
			config_json = $8,
			updated_at = NOW()
		WHERE id = $9
	`

	res, err := r.db.Exec(ctx, query,
		m.DisplayName, m.BaseURL, m.ModelIdentifier, m.APIKeyEncrypted, m.APIKeyKeyID,
		m.Visibility, m.HouseholdID, m.ConfigJSON, m.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update model block %s: %w", m.ID, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) Delete(ctx context.Context, id string) error {
	res, err := r.db.Exec(ctx, `DELETE FROM model_blocks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete model block %s: %w", id, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) UpdateHealth(ctx context.Context, id string, status HealthStatus, detail *string, checkedAt time.Time) error {
	res, err := r.db.Exec(ctx, `
		UPDATE model_blocks SET health_status = $1, health_detail = $2, health_checked_at = $3
		WHERE id = $4
	`, status, detail, checkedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update health status for model block %s: %w", id, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) HasBootstrapRun(ctx context.Context, key string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bootstrap_state WHERE key = $1)`, key).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check bootstrap state for key %s: %w", key, err)
	}
	return exists, nil
}

func (r *repository) CreateBootstrap(ctx context.Context, key string, m *ModelBlock) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin bootstrap transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now()
	m.CreatedAt = now
	m.UpdatedAt = now

	_, err = tx.Exec(ctx, `
		INSERT INTO model_blocks (
			id, owner_user_id, household_id, visibility, provider_type, display_name, base_url,
			model_identifier, api_key_encrypted, api_key_key_id, config_json, health_status,
			is_bootstrap, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`,
		m.ID, m.OwnerUserID, m.HouseholdID, m.Visibility, m.ProviderType, m.DisplayName, m.BaseURL,
		m.ModelIdentifier, m.APIKeyEncrypted, m.APIKeyKeyID, m.ConfigJSON, m.HealthStatus,
		m.IsBootstrap, m.CreatedAt, m.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert bootstrap model block: %w", err)
	}

	_, err = tx.Exec(ctx, `INSERT INTO bootstrap_state (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, key)
	if err != nil {
		return fmt.Errorf("failed to mark bootstrap key %s as applied: %w", key, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit bootstrap transaction: %w", err)
	}
	return nil
}
