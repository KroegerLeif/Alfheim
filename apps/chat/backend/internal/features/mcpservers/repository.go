package mcpservers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository defines data access operations for the MCP server registry.
type Repository interface {
	// UpsertFromSeed inserts a new registry entry for appSlug, or updates its
	// internal_url on an existing one. The enabled flag is only set (to true) on
	// first insert; re-seeding never overwrites an admin's enabled/disabled choice.
	UpsertFromSeed(ctx context.Context, appSlug, internalURL string) error
	List(ctx context.Context) ([]*Server, error)
	ListEnabled(ctx context.Context) ([]*Server, error)
	GetByID(ctx context.Context, id string) (*Server, error)
	SetEnabled(ctx context.Context, id string, enabled bool) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes a PostgreSQL-backed MCP server registry repository.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

const serverColumns = `
	id, app_slug, internal_url, enabled, last_discovery_at, last_tools_json, created_at, updated_at
`

func scanServer(row pgx.Row) (*Server, error) {
	s := &Server{}
	err := row.Scan(
		&s.ID, &s.AppSlug, &s.InternalURL, &s.Enabled, &s.LastDiscoveryAt, &s.LastToolsJSON, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *repository) UpsertFromSeed(ctx context.Context, appSlug, internalURL string) error {
	now := time.Now()
	query := `
		INSERT INTO mcp_server_registry (id, app_slug, internal_url, enabled, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, TRUE, $3, $3)
		ON CONFLICT (app_slug) DO UPDATE SET
			internal_url = EXCLUDED.internal_url,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.pool.Exec(ctx, query, appSlug, internalURL, now)
	if err != nil {
		return fmt.Errorf("failed to upsert mcp server registry entry for %s: %w", appSlug, err)
	}
	return nil
}

func (r *repository) List(ctx context.Context) ([]*Server, error) {
	return r.query(ctx, `SELECT`+serverColumns+`FROM mcp_server_registry ORDER BY app_slug ASC`)
}

func (r *repository) ListEnabled(ctx context.Context) ([]*Server, error) {
	return r.query(ctx, `SELECT`+serverColumns+`FROM mcp_server_registry WHERE enabled = TRUE ORDER BY app_slug ASC`)
}

func (r *repository) query(ctx context.Context, sql string) ([]*Server, error) {
	rows, err := r.pool.Query(ctx, sql)
	if err != nil {
		return nil, fmt.Errorf("failed to query mcp server registry: %w", err)
	}
	defer rows.Close()

	var results []*Server
	for rows.Next() {
		s, err := scanServer(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan mcp server registry row: %w", err)
		}
		results = append(results, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate mcp server registry rows: %w", err)
	}
	return results, nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*Server, error) {
	query := `SELECT` + serverColumns + `FROM mcp_server_registry WHERE id = $1`

	s, err := scanServer(r.pool.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to query mcp server registry entry %s: %w", id, err)
	}
	return s, nil
}

func (r *repository) SetEnabled(ctx context.Context, id string, enabled bool) error {
	res, err := r.pool.Exec(ctx, `UPDATE mcp_server_registry SET enabled = $1, updated_at = NOW() WHERE id = $2`, enabled, id)
	if err != nil {
		return fmt.Errorf("failed to update enabled state for mcp server %s: %w", id, err)
	}
	if res.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
