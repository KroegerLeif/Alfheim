package apps

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/dashboard/internal/shared/db"
)

// Repository database access contract for user preferences and user custom links.
type Repository interface {
	GetUserPreferences(ctx context.Context, userID string) (*UserPreferences, error)
	UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*UserPreferences, error)
	GetUserLinks(ctx context.Context, userID string) ([]*UserLink, error)
	GetUserLinkByID(ctx context.Context, id string, userID string) (*UserLink, error)
	CreateUserLink(ctx context.Context, link *UserLink) error
	UpdateUserLink(ctx context.Context, link *UserLink) error
	DeleteUserLink(ctx context.Context, id string, userID string) error
}

type repository struct {
	db db.DBTX
}

// NewRepository initializes PostgreSQL repository for 3-tier user preferences & user links.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{db: pool}
}

func newRepositoryWithDB(db db.DBTX) Repository {
	return &repository{db: db}
}

func (r *repository) GetUserPreferences(ctx context.Context, userID string) (*UserPreferences, error) {
	query := `
		SELECT user_id, hidden_app_ids, created_at, updated_at
		FROM user_preferences
		WHERE user_id = $1
	`

	pref := &UserPreferences{
		UserID:       userID,
		HiddenAppIDs: []string{},
	}

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&pref.UserID,
		&pref.HiddenAppIDs,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return default empty preferences when none exist yet
			return pref, nil
		}
		return nil, fmt.Errorf("failed to query user preferences for user %s: %w", userID, err)
	}

	return pref, nil
}

func (r *repository) UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*UserPreferences, error) {
	if hiddenAppIDs == nil {
		hiddenAppIDs = []string{}
	}

	query := `
		INSERT INTO user_preferences (user_id, hidden_app_ids, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			hidden_app_ids = EXCLUDED.hidden_app_ids,
			updated_at = NOW()
		RETURNING user_id, hidden_app_ids, created_at, updated_at
	`

	pref := &UserPreferences{}
	err := r.db.QueryRow(ctx, query, userID, hiddenAppIDs).Scan(
		&pref.UserID,
		&pref.HiddenAppIDs,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to upsert user preferences for user %s: %w", userID, err)
	}

	return pref, nil
}

func (r *repository) GetUserLinks(ctx context.Context, userID string) ([]*UserLink, error) {
	query := `
		SELECT id, user_id, title, url, COALESCE(icon, 'link'), COALESCE(category, 'user'), COALESCE(description, ''), display_order, created_at, updated_at
		FROM user_links
		WHERE user_id = $1
		ORDER BY display_order ASC, title ASC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user links for user %s: %w", userID, err)
	}
	defer rows.Close()

	var result []*UserLink
	for rows.Next() {
		link := &UserLink{}
		if err := rows.Scan(
			&link.ID,
			&link.UserID,
			&link.Title,
			&link.URL,
			&link.Icon,
			&link.Category,
			&link.Description,
			&link.DisplayOrder,
			&link.CreatedAt,
			&link.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user link row: %w", err)
		}
		result = append(result, link)
	}

	return result, nil
}

func (r *repository) GetUserLinkByID(ctx context.Context, id string, userID string) (*UserLink, error) {
	query := `
		SELECT id, user_id, title, url, COALESCE(icon, 'link'), COALESCE(category, 'user'), COALESCE(description, ''), display_order, created_at, updated_at
		FROM user_links
		WHERE id = $1 AND user_id = $2
	`

	link := &UserLink{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&link.ID,
		&link.UserID,
		&link.Title,
		&link.URL,
		&link.Icon,
		&link.Category,
		&link.Description,
		&link.DisplayOrder,
		&link.CreatedAt,
		&link.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLinkNotFound
		}
		return nil, fmt.Errorf("failed to query user link %s: %w", id, err)
	}

	return link, nil
}

func (r *repository) CreateUserLink(ctx context.Context, link *UserLink) error {
	query := `
		INSERT INTO user_links (user_id, title, url, icon, category, description, display_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(
		ctx,
		query,
		link.UserID,
		link.Title,
		link.URL,
		link.Icon,
		link.Category,
		link.Description,
		link.DisplayOrder,
	).Scan(&link.ID, &link.CreatedAt, &link.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert user link: %w", err)
	}

	return nil
}

func (r *repository) UpdateUserLink(ctx context.Context, link *UserLink) error {
	query := `
		UPDATE user_links
		SET title = $1, url = $2, icon = $3, category = $4, description = $5, updated_at = NOW()
		WHERE id = $6 AND user_id = $7
	`

	tag, err := r.db.Exec(
		ctx,
		query,
		link.Title,
		link.URL,
		link.Icon,
		link.Category,
		link.Description,
		link.ID,
		link.UserID,
	)

	if err != nil {
		return fmt.Errorf("failed to update user link %s: %w", link.ID, err)
	}

	if tag.RowsAffected() == 0 {
		return ErrLinkNotFound
	}

	return nil
}

func (r *repository) DeleteUserLink(ctx context.Context, id string, userID string) error {
	query := `DELETE FROM user_links WHERE id = $1 AND user_id = $2`

	tag, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user link %s: %w", id, err)
	}

	if tag.RowsAffected() == 0 {
		return ErrLinkNotFound
	}

	return nil
}
