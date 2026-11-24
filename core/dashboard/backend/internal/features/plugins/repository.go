package plugins

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"alfheim/go-shared/db"
)

// Repository stores plugin rows. Every method takes the household the
// membership check confirmed and filters by it.
type Repository interface {
	List(ctx context.Context, householdID uuid.UUID) ([]Record, error)
	Get(ctx context.Context, householdID uuid.UUID, pluginType string) (Record, error)
	Upsert(ctx context.Context, rec *Record) error
	SaveHealth(ctx context.Context, householdID uuid.UUID, pluginType string, h HealthResult) error
}

type repository struct {
	db db.DBTX
}

// NewRepository returns the PostgreSQL repository on conn (a pool or a transaction).
func NewRepository(conn db.DBTX) Repository {
	return &repository{db: conn}
}

const selectColumns = `id, household_id, type, enabled, base_url, config, credentials_encrypted,
	credentials_key_id, health_status, health_checked_at, health_detail, created_at, updated_at`

func scanRecord(row pgx.Row) (Record, error) {
	var (
		rec    Record
		config []byte
		status string
	)
	err := row.Scan(&rec.ID, &rec.HouseholdID, &rec.Type, &rec.Enabled, &rec.BaseURL, &config,
		&rec.CredentialsEncrypted, &rec.CredentialsKeyID, &status, &rec.HealthCheckedAt,
		&rec.HealthDetail, &rec.CreatedAt, &rec.UpdatedAt)
	rec.Config = config
	rec.HealthStatus = HealthStatus(status)
	return rec, err
}

func (r *repository) List(ctx context.Context, householdID uuid.UUID) ([]Record, error) {
	rows, err := r.db.Query(ctx, `SELECT `+selectColumns+`
		FROM household_plugins WHERE household_id = $1 ORDER BY type`, householdID)
	if err != nil {
		return nil, fmt.Errorf("query plugins: %w", err)
	}
	defer rows.Close()

	out := []Record{}
	for rows.Next() {
		rec, err := scanRecord(rows)
		if err != nil {
			return nil, fmt.Errorf("scan plugin: %w", err)
		}
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate plugins: %w", err)
	}
	return out, nil
}

func (r *repository) Get(ctx context.Context, householdID uuid.UUID, pluginType string) (Record, error) {
	rec, err := scanRecord(r.db.QueryRow(ctx, `SELECT `+selectColumns+`
		FROM household_plugins WHERE household_id = $1 AND type = $2`, householdID, pluginType))
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrNotConfigured
	}
	if err != nil {
		return Record{}, fmt.Errorf("get plugin: %w", err)
	}
	return rec, nil
}

// Upsert inserts or replaces the household's row of rec.Type. A saved
// configuration has not been tested yet, so the stored health is reset.
func (r *repository) Upsert(ctx context.Context, rec *Record) error {
	config := string(rec.Config)
	if config == "" {
		config = "{}"
	}
	err := r.db.QueryRow(ctx, `INSERT INTO household_plugins
		(household_id, type, enabled, base_url, config, credentials_encrypted, credentials_key_id)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
		ON CONFLICT (household_id, type) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			base_url = EXCLUDED.base_url,
			config = EXCLUDED.config,
			credentials_encrypted = EXCLUDED.credentials_encrypted,
			credentials_key_id = EXCLUDED.credentials_key_id,
			health_status = 'unknown',
			health_checked_at = NULL,
			health_detail = '',
			updated_at = NOW()
		RETURNING id, created_at, updated_at`,
		rec.HouseholdID, rec.Type, rec.Enabled, rec.BaseURL, config,
		rec.CredentialsEncrypted, rec.CredentialsKeyID,
	).Scan(&rec.ID, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert plugin: %w", err)
	}
	rec.HealthStatus, rec.HealthCheckedAt, rec.HealthDetail = StatusUnknown, nil, ""
	return nil
}

func (r *repository) SaveHealth(ctx context.Context, householdID uuid.UUID, pluginType string, h HealthResult) error {
	tag, err := r.db.Exec(ctx, `UPDATE household_plugins
		SET health_status = $3, health_checked_at = $4, health_detail = $5
		WHERE household_id = $1 AND type = $2`,
		householdID, pluginType, string(h.Status), h.CheckedAt.UTC().Truncate(time.Microsecond), h.Detail)
	if err != nil {
		return fmt.Errorf("save plugin health: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotConfigured
	}
	return nil
}
