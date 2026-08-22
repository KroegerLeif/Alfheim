package household

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

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
