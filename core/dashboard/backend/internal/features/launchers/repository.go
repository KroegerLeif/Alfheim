package launchers

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"alfheim/go-shared/db"
)

// Repository stores launchers. Every method takes the household the
// membership check confirmed and filters by it.
type Repository interface {
	List(ctx context.Context, householdID uuid.UUID, limit, offset int) (Page, error)
	Create(ctx context.Context, l *Launcher) error
	Update(ctx context.Context, l *Launcher) error
	Delete(ctx context.Context, householdID, id uuid.UUID) error
}

type repository struct {
	db db.DBTX
}

// NewRepository returns the PostgreSQL repository on conn (a pool or a transaction).
func NewRepository(conn db.DBTX) Repository {
	return &repository{db: conn}
}

const selectColumns = `id, household_id, title, url, icon, description, display_order, created_by, created_at, updated_at`

func (r *repository) List(ctx context.Context, householdID uuid.UUID, limit, offset int) (Page, error) {
	var total int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM household_launchers WHERE household_id = $1`, householdID,
	).Scan(&total); err != nil {
		return Page{}, fmt.Errorf("count launchers: %w", err)
	}

	rows, err := r.db.Query(ctx, `SELECT `+selectColumns+`
		FROM household_launchers
		WHERE household_id = $1
		ORDER BY display_order ASC, title ASC, id ASC
		LIMIT $2 OFFSET $3`, householdID, limit, offset)
	if err != nil {
		return Page{}, fmt.Errorf("query launchers: %w", err)
	}
	defer rows.Close()

	items := []Launcher{}
	for rows.Next() {
		var l Launcher
		if err := rows.Scan(&l.ID, &l.HouseholdID, &l.Title, &l.URL, &l.Icon, &l.Description,
			&l.DisplayOrder, &l.CreatedBy, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return Page{}, fmt.Errorf("scan launcher: %w", err)
		}
		items = append(items, l)
	}
	if err := rows.Err(); err != nil {
		return Page{}, fmt.Errorf("iterate launchers: %w", err)
	}
	return Page{Items: items, Total: total}, nil
}

func (r *repository) Create(ctx context.Context, l *Launcher) error {
	err := r.db.QueryRow(ctx, `INSERT INTO household_launchers
		(household_id, title, url, icon, description, display_order, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`,
		l.HouseholdID, l.Title, l.URL, l.Icon, l.Description, l.DisplayOrder, l.CreatedBy,
	).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert launcher: %w", err)
	}
	return nil
}

func (r *repository) Update(ctx context.Context, l *Launcher) error {
	err := r.db.QueryRow(ctx, `UPDATE household_launchers
		SET title = $3, url = $4, icon = $5, description = $6, display_order = $7, updated_at = NOW()
		WHERE id = $1 AND household_id = $2
		RETURNING created_by, created_at, updated_at`,
		l.ID, l.HouseholdID, l.Title, l.URL, l.Icon, l.Description, l.DisplayOrder,
	).Scan(&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update launcher: %w", err)
	}
	return nil
}

func (r *repository) Delete(ctx context.Context, householdID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM household_launchers WHERE id = $1 AND household_id = $2`, id, householdID)
	if err != nil {
		return fmt.Errorf("delete launcher: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
