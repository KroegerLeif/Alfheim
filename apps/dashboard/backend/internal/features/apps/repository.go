package apps

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository database access contract for app catalog.
type Repository interface {
	GetActiveApps(ctx context.Context) ([]*AppItem, error)
	GetAppByID(ctx context.Context, id string) (*AppItem, error)
	CreateApp(ctx context.Context, app *AppItem) error
	UpdateApp(ctx context.Context, app *AppItem) error
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

func (r *repository) GetAppByID(ctx context.Context, id string) (*AppItem, error) {
	query := `
		SELECT id, name, slug, description, icon_url, app_url, category, required_role, is_active,
		       COALESCE(is_external, FALSE) as is_external,
		       COALESCE(status, 'active') as status,
		       COALESCE(is_default, TRUE) as is_default,
		       display_order, created_at, updated_at
		FROM app_catalog
		WHERE id = $1
	`

	app := &AppItem{}
	var catStr, roleStr string
	err := r.pool.QueryRow(ctx, query, id).Scan(
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
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAppNotFound
		}
		return nil, fmt.Errorf("failed to query app by id %s: %w", id, err)
	}

	app.Title = app.Name
	app.Icon = app.IconURL
	app.URL = app.AppURL
	app.Category = AppCategory(catStr)
	app.RequiredRole = AppRole(roleStr)
	return app, nil
}

func (r *repository) UpdateApp(ctx context.Context, app *AppItem) error {
	query := `
		UPDATE app_catalog
		SET name = $1, slug = $2, description = $3, icon_url = $4, app_url = $5, category = $6, is_external = $7, status = $8, updated_at = NOW()
		WHERE id = $9
	`

	tag, err := r.pool.Exec(
		ctx,
		query,
		app.Name,
		app.Slug,
		app.Description,
		app.IconURL,
		app.AppURL,
		string(app.Category),
		app.IsExternal,
		app.Status,
		app.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update app catalog item %s: %w", app.ID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAppNotFound
	}
	return nil
}

func (r *repository) SeedDefaultApps(ctx context.Context) error {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM app_catalog").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count app catalog rows: %w", err)
	}
	if count > 0 {
		return nil
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
		{"Chores Tracker", "chores", "Haushaltsroutinen, Daily Resets & Streaks", "cleaning_services", "/chores/de", "internal", "MEMBER", false, "active", true, 4},
		{"Task Tracker (TODO)", "todo", "Manage personal and household tasks and reminders.", "checklist", "/under-construction?app=TODO", "internal", "MEMBER", false, "in_progress", true, 5},
		{"Home Assistant", "home-assistant", "Smart home automation, climate control, and security dashboard.", "home", "http://homeassistant.local", "external", "MEMBER", true, "active", true, 6},
		{"Plex Media Server", "plex", "Stream movies, TV shows, and personal media across devices.", "movie", "/under-construction?app=Plex", "external", "MEMBER", true, "in_progress", true, 7},
		{"Nextcloud Storage", "nextcloud", "Private cloud storage, photos, and document synchronization.", "cloud", "/under-construction?app=Nextcloud", "external", "MEMBER", true, "in_progress", true, 8},
	}

	insertQuery := `
		INSERT INTO app_catalog (name, slug, description, icon_url, app_url, category, required_role, is_active, is_external, status, is_default, display_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11)
		ON CONFLICT (slug) DO UPDATE SET app_url = EXCLUDED.app_url
	`

	for _, app := range defaultApps {
		_, err := r.pool.Exec(ctx, insertQuery, app.Name, app.Slug, app.Description, app.IconURL, app.AppURL, app.Category, app.RequiredRole, app.IsExternal, app.Status, app.IsDefault, app.DisplayOrder)
		if err != nil {
			return fmt.Errorf("failed to seed app %s: %w", app.Name, err)
		}
	}

	return nil
}
