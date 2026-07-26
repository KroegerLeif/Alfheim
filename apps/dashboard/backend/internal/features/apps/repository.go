package apps

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository database access contract for app catalog.
type Repository interface {
	GetActiveApps(ctx context.Context) ([]*AppItem, error)
	CreateApp(ctx context.Context, app *AppItem) error
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
		SELECT id, name, slug, description, icon_url, app_url, category, required_role, is_active,
		       COALESCE(is_external, FALSE) as is_external,
		       COALESCE(status, 'active') as status,
		       COALESCE(is_default, TRUE) as is_default,
		       display_order, created_at, updated_at
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
			&app.IsExternal,
			&app.Status,
			&app.IsDefault,
			&app.DisplayOrder,
			&app.CreatedAt,
			&app.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan app row: %w", err)
		}
		app.Title = app.Name
		app.Icon = app.IconURL
		app.URL = app.AppURL
		app.Category = AppCategory(catStr)
		app.RequiredRole = AppRole(roleStr)
		result = append(result, app)
	}

	return result, nil
}

func (r *repository) CreateApp(ctx context.Context, app *AppItem) error {
	query := `
		INSERT INTO app_catalog (name, slug, description, icon_url, app_url, category, required_role, is_active, is_external, status, is_default, display_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`

	err := r.pool.QueryRow(
		ctx,
		query,
		app.Name,
		app.Slug,
		app.Description,
		app.IconURL,
		app.AppURL,
		string(app.Category),
		string(app.RequiredRole),
		app.IsExternal,
		app.Status,
		app.IsDefault,
		app.DisplayOrder,
	).Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert new app catalog item: %w", err)
	}

	app.Title = app.Name
	app.Icon = app.IconURL
	app.URL = app.AppURL
	app.IsActive = true
	return nil
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
		IsExternal   bool
		Status       string
		IsDefault    bool
		DisplayOrder int
	}{
		{"Digital Pantry", "pantry", "Manage household food inventory, recipes, and expiration dates.", "kitchen", "/pantry", "internal", "MEMBER", false, "active", true, 1},
		{"Smart Shopping", "shopping", "Automated shopping list generator and store price aggregator.", "shopping_cart", "/shopping", "internal", "MEMBER", false, "active", true, 2},
		{"Maintenance Hub", "maintenance", "Schedule device maintenance and home repairs.", "build", "/maintenance", "internal", "MEMBER", false, "active", true, 3},
		{"Task Tracker (TODO)", "todo", "Manage personal and household tasks and reminders.", "checklist", "/under-construction?app=TODO", "internal", "MEMBER", false, "in_progress", true, 4},
		{"Home Assistant", "home-assistant", "Smart home automation, climate control, and security dashboard.", "home", "http://homeassistant.local", "external", "MEMBER", true, "active", true, 5},
		{"Plex Media Server", "plex", "Stream movies, TV shows, and personal media across devices.", "movie", "/under-construction?app=Plex", "external", "MEMBER", true, "in_progress", true, 6},
		{"Nextcloud Storage", "nextcloud", "Private cloud storage, photos, and document synchronization.", "cloud", "/under-construction?app=Nextcloud", "external", "MEMBER", true, "in_progress", true, 7},
	}

	insertQuery := `
		INSERT INTO app_catalog (name, slug, description, icon_url, app_url, category, required_role, is_active, is_external, status, is_default, display_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11)
	`

	for _, app := range defaultApps {
		_, err := r.pool.Exec(ctx, insertQuery, app.Name, app.Slug, app.Description, app.IconURL, app.AppURL, app.Category, app.RequiredRole, app.IsExternal, app.Status, app.IsDefault, app.DisplayOrder)
		if err != nil {
			return fmt.Errorf("failed to seed app %s: %w", app.Name, err)
		}
	}

	return nil
}
