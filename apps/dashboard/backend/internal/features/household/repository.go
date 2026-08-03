package household

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository persistence contract for household entities and invitations.
type Repository interface {
	CreateHouseholdTx(ctx context.Context, h *Household, ownerEmail, ownerUsername string) error
	GetHouseholdByID(ctx context.Context, id string) (*Household, error)
	GetHouseholdsByUserID(ctx context.Context, userID string) ([]*Household, error)
	AddMember(ctx context.Context, m *Member) error
	RemoveMember(ctx context.Context, householdID string, userID string) error
	UpdateMemberRole(ctx context.Context, householdID string, userID string, role HouseholdRole) error
	GetMemberRole(ctx context.Context, householdID string, userID string) (HouseholdRole, error)
	GetMembers(ctx context.Context, householdID string) ([]*Member, error)
	CreateInvite(ctx context.Context, invite *Invite) error
	GetInviteByToken(ctx context.Context, token string) (*Invite, error)
	IncrementInviteUses(ctx context.Context, token string) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes PostgreSQL-backed repository for households.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}

func (r *repository) CreateHouseholdTx(ctx context.Context, h *Household, ownerEmail, ownerUsername string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start household creation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure the user profile exists JIT to prevent foreign key errors on household_members or households
	ensureUserProfile := `
		INSERT INTO user_profiles (id, email, username, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, err = tx.Exec(ctx, ensureUserProfile, h.OwnerID, ownerEmail, ownerUsername)
	if err != nil {
		return fmt.Errorf("failed to ensure user profile exists in transaction: %w", err)
	}

	insertHousehold := `
		INSERT INTO households (id, name, slug, owner_id)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at, updated_at
	`
	err = tx.QueryRow(ctx, insertHousehold, h.ID, h.Name, h.Slug, h.OwnerID).Scan(&h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // Unique violation for slug
			return ErrHouseholdSlugExists
		}
		return fmt.Errorf("failed to insert household: %w", err)
	}

	insertOwnerMember := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
	`
	_, err = tx.Exec(ctx, insertOwnerMember, h.ID, h.OwnerID, string(RoleOwner))
	if err != nil {
		return fmt.Errorf("failed to assign owner member in transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit household creation transaction: %w", err)
	}

	return nil
}

func (r *repository) GetHouseholdByID(ctx context.Context, id string) (*Household, error) {
	query := `
		SELECT id, name, slug, owner_id, created_at, updated_at
		FROM households
		WHERE id = $1
	`
	h := &Household{}
	err := r.pool.QueryRow(ctx, query, id).Scan(&h.ID, &h.Name, &h.Slug, &h.OwnerID, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrHouseholdNotFound
		}
		return nil, fmt.Errorf("failed to query household by id %s: %w", id, err)
	}
	return h, nil
}

func (r *repository) GetHouseholdsByUserID(ctx context.Context, userID string) ([]*Household, error) {
	query := `
		SELECT h.id, h.name, h.slug, h.owner_id, h.created_at, h.updated_at
		FROM households h
		INNER JOIN household_members hm ON h.id = hm.household_id
		WHERE hm.user_id = $1
		ORDER BY h.created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query households for user %s: %w", userID, err)
	}
	defer rows.Close()

	var results []*Household
	for rows.Next() {
		h := &Household{}
		if err := rows.Scan(&h.ID, &h.Name, &h.Slug, &h.OwnerID, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan household row: %w", err)
		}
		results = append(results, h)
	}

	return results, nil
}

func (r *repository) AddMember(ctx context.Context, m *Member) error {
	query := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
	`
	_, err := r.pool.Exec(ctx, query, m.HouseholdID, m.UserID, string(m.Role))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrMemberAlreadyExists
		}
		return fmt.Errorf("failed to add member to household: %w", err)
	}
	return nil
}

func (r *repository) RemoveMember(ctx context.Context, householdID string, userID string) error {
	query := `
		DELETE FROM household_members
		WHERE household_id = $1 AND user_id = $2
	`
	cmd, err := r.pool.Exec(ctx, query, householdID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrMemberNotFound
	}
	return nil
}

func (r *repository) UpdateMemberRole(ctx context.Context, householdID string, userID string, role HouseholdRole) error {
	query := `
		UPDATE household_members
		SET role = $1
		WHERE household_id = $2 AND user_id = $3
	`
	cmd, err := r.pool.Exec(ctx, query, string(role), householdID, userID)
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrMemberNotFound
	}
	return nil
}

func (r *repository) GetMemberRole(ctx context.Context, householdID string, userID string) (HouseholdRole, error) {
	query := `
		SELECT role
		FROM household_members
		WHERE household_id = $1 AND user_id = $2
	`
	var roleStr string
	err := r.pool.QueryRow(ctx, query, householdID, userID).Scan(&roleStr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrUnauthorizedHouseholdAccess
		}
		return "", fmt.Errorf("failed to query member role: %w", err)
	}
	return HouseholdRole(roleStr), nil
}

func (r *repository) GetMembers(ctx context.Context, householdID string) ([]*Member, error) {
	query := `
		SELECT hm.household_id, hm.user_id, hm.role, hm.joined_at,
		       COALESCE(p.email, '') as email,
		       COALESCE(p.username, '') as username,
		       COALESCE(p.first_name, '') as first_name,
		       COALESCE(p.last_name, '') as last_name,
		       COALESCE(p.avatar_url, '') as avatar_url
		FROM household_members hm
		LEFT JOIN user_profiles p ON hm.user_id = p.id
		WHERE hm.household_id = $1
		ORDER BY hm.joined_at ASC
	`
	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("failed to query household members: %w", err)
	}
	defer rows.Close()

	var members []*Member
	for rows.Next() {
		m := &Member{}
		var roleStr string
		if err := rows.Scan(
			&m.HouseholdID,
			&m.UserID,
			&roleStr,
			&m.JoinedAt,
			&m.Email,
			&m.Username,
			&m.FirstName,
			&m.LastName,
			&m.AvatarURL,
		); err != nil {
			return nil, fmt.Errorf("failed to scan member row: %w", err)
		}
		m.Role = HouseholdRole(roleStr)
		members = append(members, m)
	}
	return members, nil
}

func (r *repository) CreateInvite(ctx context.Context, invite *Invite) error {
	query := `
		INSERT INTO household_invites (token, household_id, inviter_id, role, expires_at, max_uses, uses, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if invite.CreatedAt.IsZero() {
		invite.CreatedAt = time.Now()
	}
	_, err := r.pool.Exec(ctx, query,
		invite.Token,
		invite.HouseholdID,
		invite.InviterID,
		string(invite.Role),
		invite.ExpiresAt,
		invite.MaxUses,
		invite.Uses,
		invite.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert household invite token: %w", err)
	}
	return nil
}

func (r *repository) GetInviteByToken(ctx context.Context, token string) (*Invite, error) {
	query := `
		SELECT token, household_id, inviter_id, role, expires_at, max_uses, uses, created_at
		FROM household_invites
		WHERE token = $1
	`
	i := &Invite{}
	var roleStr string
	err := r.pool.QueryRow(ctx, query, token).Scan(
		&i.Token,
		&i.HouseholdID,
		&i.InviterID,
		&roleStr,
		&i.ExpiresAt,
		&i.MaxUses,
		&i.Uses,
		&i.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInviteNotFound
		}
		return nil, fmt.Errorf("failed to query invite token: %w", err)
	}
	i.Role = HouseholdRole(roleStr)
	return i, nil
}

func (r *repository) IncrementInviteUses(ctx context.Context, token string) error {
	query := `
		UPDATE household_invites
		SET uses = uses + 1
		WHERE token = $1
	`
	_, err := r.pool.Exec(ctx, query, token)
	if err != nil {
		return fmt.Errorf("failed to increment invite uses: %w", err)
	}
	return nil
}
