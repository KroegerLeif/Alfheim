package household

import (
	"context"
	"log/slog"

	"alfheim/dashboard/internal/shared/middleware"
)

// Service defines business logic for household management, authorization, and invitations.
type Service interface {
	CreateHousehold(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error)
	GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponse, error)
	GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error)
	CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error)
	JoinHousehold(ctx context.Context, userID string, token string) (*HouseholdResponse, error)
	RemoveMember(ctx context.Context, requesterID string, householdID string, targetUserID string) error
	UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error
	UpdateHouseholdAddress(ctx context.Context, requesterID string, householdID string, req UpdateHouseholdAddressRequest) error
}

type service struct {
	repo Repository
	log  *slog.Logger
}

// NewService constructs a household service implementation.
func NewService(repo Repository, log *slog.Logger) Service {
	return &service{
		repo: repo,
		log:  log,
	}
}
