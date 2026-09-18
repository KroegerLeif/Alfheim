package household

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"alfheim/household/internal/shared/db"
)

// Repository persistence contract for household entities and invitations.
type Repository interface {
	CreateHouseholdTx(ctx context.Context, h *Household, ownerEmail, ownerUsername string) error
	GetHouseholdByID(ctx context.Context, id string) (*Household, error)
	GetHouseholdsByUserID(ctx context.Context, userID string) ([]*Household, error)
	RenameHousehold(ctx context.Context, id string, name string) error
	DeleteHousehold(ctx context.Context, id string) error
	TransferOwnershipTx(ctx context.Context, householdID, fromUserID, toUserID string) error
	GetDefaultHouseholdID(ctx context.Context, userID string) (string, error)
	SetDefaultHouseholdTx(ctx context.Context, userID, householdID string) error
	RemoveMember(ctx context.Context, householdID string, userID string) error
	UpdateMemberRole(ctx context.Context, householdID string, userID string, role HouseholdRole) error
	GetMemberRole(ctx context.Context, householdID string, userID string) (HouseholdRole, error)
	GetMembers(ctx context.Context, householdID string) ([]*Member, error)
	CreateInvite(ctx context.Context, invite *Invite) error
	ListActiveInvites(ctx context.Context, householdID string) ([]*Invite, error)
	DeleteInvite(ctx context.Context, householdID string, token string) error
	RedeemInviteTx(ctx context.Context, token, userID, email, username string) (*Invite, error)
	UpdateHouseholdAddress(ctx context.Context, id string, street, zip, city, country string, latitude, longitude *float64) error
}

type repository struct {
	db db.DBTX
}

// NewRepository initializes PostgreSQL-backed repository for households.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &repository{db: pool}
}

func newRepositoryWithDB(db db.DBTX) Repository {
	return &repository{db: db}
}

// PostgreSQL error codes used for domain error mapping.
const (
	pgUniqueViolation           = "23505"
	pgInvalidTextRepresentation = "22P02"
)

// isPgError reports whether err is a PostgreSQL error with the given code.
func isPgError(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}

// ensureUserProfileSQL provisions a minimal profile row just in time so that
// foreign keys from households, members and invites always resolve.
const ensureUserProfileSQL = `
	INSERT INTO user_profiles (id, email, username, created_at, updated_at)
	VALUES ($1, $2, $3, NOW(), NOW())
	ON CONFLICT (id) DO NOTHING
`
