package household

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (r *repository) AddMember(ctx context.Context, m *Member) error {
	query := `
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, $3)
	`
	_, err := r.db.Exec(ctx, query, m.HouseholdID, m.UserID, string(m.Role))
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
	cmd, err := r.db.Exec(ctx, query, householdID, userID)
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
	cmd, err := r.db.Exec(ctx, query, string(role), householdID, userID)
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
	err := r.db.QueryRow(ctx, query, householdID, userID).Scan(&roleStr)
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
	rows, err := r.db.Query(ctx, query, householdID)
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
