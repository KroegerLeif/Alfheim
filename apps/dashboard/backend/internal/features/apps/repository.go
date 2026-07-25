package apps

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository database access contract for app catalog.
type Repository interface {
	GetActiveApps(ctx context.Context) ([]*AppItem, error)
	SeedDefaultApps(ctx context.Context) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes PostgreSQL repository for app catalog.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) GetActiveApps(ctx context.Context) ([]*AppItem, error) {
	query := `
		SELECT id, name, slug, description, icon_url, app_url, category, required_role, is_active, display_order, created_at, updated_at
		FROM app_catalog
		WHERE is_active = TRUE
		ORDER BY display_order ASC, name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active apps: %w", err)
	}
	defer rows.Close()

	var result []*AppItem
	for rows.Next() {
		app := &AppItem{}
		var catStr, roleStr string
		if err := rows.Scan(
			&app.ID,
			&app.Name,
			&app.Slug,
			&app.Description,
			&app.IconURL,
			&app.AppURL,
			&catStr,
			&roleStr,
			&app.IsActive,
			&app.DisplayOrder,
			&app.CreatedAt,
			&app.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan app row: %w", err)
		}
		app.Category = AppCategory(catStr)
		app.RequiredRole = AppRole(roleStr)
		result = append(result, app)
	}

	return result, nil
}

func (r *repository) SeedDefaultApps(ctx context.Context) error {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM app_catalog").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count app catalog rows: %w", err)
	}

	if count > 0 {
		return nil // Already seeded
	}

	defaultApps := []struct {
		Name         string
		Slug         string
		Description  string
		IconURL      string
		AppURL       string
		Category     string
		RequiredRole string
		DisplayOrder int
	}{
		{"Pantry & Inventory", "pantry", "Food inventory, stock tracking, and expiry alerts", "/icons/pantry.svg", "/pantry", "internal", "MEMBER", 1},
		{"Maintenance & Tasks", "maintenance", "Home maintenance schedule, vehicle upkeep, and repairs", "/icons/maintenance.svg", "/maintenance", "internal", "MEMBER", 2},
		{"Shopping List", "shopping", "Collaborative household shopping lists and budget tracking", "/icons/shopping.svg", "/shopping", "internal", "MEMBER", 3},
		{"Home Assistant", "home-assistant", "Smart home automation, climate control, and security", "/icons/ha.svg", "https://ha.loeger.local", "external", "ADMIN", 4},
		{"Nextcloud Storage", "nextcloud", "Private cloud storage, photos, and document sync", "/icons/nextcloud.svg", "https://cloud.loeger.local", "external", "MEMBER", 5},
	}

	insertQuery := `
		INSERT INTO app_catalog (name, slug, description, icon_url, app_url, category, required_role, is_active, display_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
	`

	for _, app := range defaultApps {
		_, err := r.pool.Exec(ctx, insertQuery, app.Name, app.Slug, app.Description, app.IconURL, app.AppURL, app.Category, app.RequiredRole, app.DisplayOrder)
		if err != nil {
			return fmt.Errorf("failed to seed app %s: %w", app.Name, err)
		}
	}

	return nil
}
