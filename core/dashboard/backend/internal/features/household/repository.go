package household

import (
	"context"

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
	UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error
}

type repository struct {
	pool *pgxpool.Pool
}

// NewRepository initializes PostgreSQL-backed repository for households.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{pool: pool}
}
