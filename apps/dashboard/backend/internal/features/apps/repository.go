package apps

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository database access contract for app catalog.
type Repository interface {
	ListActiveApps(ctx context.Context) ([]*App, error)
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes PostgreSQL repository for app catalog.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) ListActiveApps(ctx context.Context) ([]*App, error) {
	query := `
		SELECT id, name, slug, description, icon_url, app_url, required_role, is_active, created_at, updated_at
		FROM app_catalog
		WHERE is_active = TRUE
		ORDER BY name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active apps: %w", err)
	}
	defer rows.Close()

	var result []*App
	for rows.Next() {
		app := &App{}
		if err := rows.Scan(
			&app.ID,
			&app.Name,
			&app.Slug,
			&app.Description,
			&app.IconURL,
			&app.AppURL,
			&app.RequiredRole,
			&app.IsActive,
			&app.CreatedAt,
			&app.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan app row: %w", err)
		}
		result = append(result, app)
	}

	return result, nil
}
