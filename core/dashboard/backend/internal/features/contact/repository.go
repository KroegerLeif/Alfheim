package contact

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository defines CRUD operations for contact categories and contact records.
type Repository interface {
	CreateCategory(ctx context.Context, cat *ContactCategory) error
	GetCategories(ctx context.Context, householdID string) ([]*ContactCategory, error)
	GetCategoryByID(ctx context.Context, id string) (*ContactCategory, error)
	UpdateCategory(ctx context.Context, cat *ContactCategory) error
	DeleteCategory(ctx context.Context, id string) error

	CreateContact(ctx context.Context, c *Contact) error
	GetContacts(ctx context.Context, householdID string) ([]*Contact, error)
	GetContactByID(ctx context.Context, id string) (*Contact, error)
	UpdateContact(ctx context.Context, c *Contact) error
	DeleteContact(ctx context.Context, id string) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes a PostgreSQL implementation of Contact Repository.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) CreateCategory(ctx context.Context, cat *ContactCategory) error {
	query := `
		INSERT INTO contact_categories (id, household_id, name, icon, color, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING created_at, updated_at
	`
	return r.pool.QueryRow(ctx, query, cat.ID, cat.HouseholdID, cat.Name, cat.Icon, cat.Color).Scan(&cat.CreatedAt, &cat.UpdatedAt)
}

func (r *repository) GetCategories(ctx context.Context, householdID string) ([]*ContactCategory, error) {
	query := `
		SELECT id, household_id, name, icon, color, created_at, updated_at
		FROM contact_categories
		WHERE household_id = $1
		ORDER BY name ASC
	`
	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to query contact categories: %w", err)
	}
	defer rows.Close()

	var results []*ContactCategory
	for rows.Next() {
		cat := &ContactCategory{}
		if err := rows.Scan(&cat.ID, &cat.HouseholdID, &cat.Name, &cat.Icon, &cat.Color, &cat.CreatedAt, &cat.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan contact category: %w", err)
		}
		results = append(results, cat)
	}
	return results, nil
}

func (r *repository) GetCategoryByID(ctx context.Context, id string) (*ContactCategory, error) {
	query := `
		SELECT id, household_id, name, icon, color, created_at, updated_at
		FROM contact_categories
		WHERE id = $1
	`
	cat := &ContactCategory{}
	err := r.pool.QueryRow(ctx, query, id).Scan(&cat.ID, &cat.HouseholdID, &cat.Name, &cat.Icon, &cat.Color, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, fmt.Errorf("failed to query contact category by id: %w", err)
	}
	return cat, nil
}

func (r *repository) UpdateCategory(ctx context.Context, cat *ContactCategory) error {
	query := `
		UPDATE contact_categories
		SET name = $1, icon = $2, color = $3, updated_at = NOW()
		WHERE id = $4
	`
	cmd, err := r.pool.Exec(ctx, query, cat.Name, cat.Icon, cat.Color, cat.ID)
	if err != nil {
		return fmt.Errorf("failed to update contact category: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

func (r *repository) DeleteCategory(ctx context.Context, id string) error {
	query := `DELETE FROM contact_categories WHERE id = $1`
	cmd, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete contact category: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}
	return nil
}

func (r *repository) CreateContact(ctx context.Context, c *Contact) error {
	query := `
		INSERT INTO contacts (id, household_id, category_id, name, phone, email, address, latitude, longitude, description, links, icon, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
		RETURNING created_at, updated_at
	`
	linksJSON, err := json.Marshal(c.Links)
	if err != nil {
		return fmt.Errorf("failed to marshal contact links: %w", err)
	}

	return r.pool.QueryRow(ctx, query,
		c.ID, c.HouseholdID, c.CategoryID, c.Name, c.Phone, c.Email,
		c.Address, c.Latitude, c.Longitude, c.Description, linksJSON,
		c.Icon, c.AvatarURL,
	).Scan(&c.CreatedAt, &c.UpdatedAt)
}

func (r *repository) GetContacts(ctx context.Context, householdID string) ([]*Contact, error) {
	query := `
		SELECT id, household_id, category_id, name, phone, email, address, latitude, longitude, description, links, icon, avatar_url, created_at, updated_at
		FROM contacts
		WHERE household_id = $1
		ORDER BY name ASC
	`
	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to query contacts: %w", err)
	}
	defer rows.Close()

	var results []*Contact
	for rows.Next() {
		c := &Contact{}
		var linksBytes []byte
		err := rows.Scan(
			&c.ID, &c.HouseholdID, &c.CategoryID, &c.Name, &c.Phone, &c.Email,
			&c.Address, &c.Latitude, &c.Longitude, &c.Description, &linksBytes,
			&c.Icon, &c.AvatarURL, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan contact: %w", err)
		}
		if len(linksBytes) > 0 {
			if err := json.Unmarshal(linksBytes, &c.Links); err != nil {
				c.Links = []string{}
			}
		} else {
			c.Links = []string{}
		}
		results = append(results, c)
	}
	return results, nil
}

func (r *repository) GetContactByID(ctx context.Context, id string) (*Contact, error) {
	query := `
		SELECT id, household_id, category_id, name, phone, email, address, latitude, longitude, description, links, icon, avatar_url, created_at, updated_at
		FROM contacts
		WHERE id = $1
	`
	c := &Contact{}
	var linksBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.HouseholdID, &c.CategoryID, &c.Name, &c.Phone, &c.Email,
		&c.Address, &c.Latitude, &c.Longitude, &c.Description, &linksBytes,
		&c.Icon, &c.AvatarURL, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrContactNotFound
		}
		return nil, fmt.Errorf("failed to query contact by id: %w", err)
	}
	if len(linksBytes) > 0 {
		if err := json.Unmarshal(linksBytes, &c.Links); err != nil {
			c.Links = []string{}
		}
	} else {
		c.Links = []string{}
	}
	return c, nil
}

func (r *repository) UpdateContact(ctx context.Context, c *Contact) error {
	query := `
		UPDATE contacts
		SET category_id = $1, name = $2, phone = $3, email = $4, address = $5, latitude = $6, longitude = $7, description = $8, links = $9, icon = $10, avatar_url = $11, updated_at = NOW()
		WHERE id = $12
	`
	linksJSON, err := json.Marshal(c.Links)
	if err != nil {
		return fmt.Errorf("failed to marshal contact links: %w", err)
	}

	cmd, err := r.pool.Exec(ctx, query,
		c.CategoryID, c.Name, c.Phone, c.Email, c.Address,
		c.Latitude, c.Longitude, c.Description, linksJSON, c.Icon, c.AvatarURL, c.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update contact: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrContactNotFound
	}
	return nil
}

func (r *repository) DeleteContact(ctx context.Context, id string) error {
	query := `DELETE FROM contacts WHERE id = $1`
	cmd, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete contact: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrContactNotFound
	}
	return nil
}
