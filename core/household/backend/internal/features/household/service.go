package household

import (
	"context"
	"log/slog"

	"alfheim/household/internal/shared/middleware"
)

// Service defines business logic for household management, authorization, and invitations.
//
// Authorization is always derived from household_members for the household id
// passed in; it never trusts client-supplied household or role headers.
type Service interface {
	CreateHousehold(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error)
	GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponse, error)
	GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error)
	RenameHousehold(ctx context.Context, requesterID string, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error)
	DeleteHousehold(ctx context.Context, requesterID string, householdID string) error
	TransferOwnership(ctx context.Context, requesterID string, householdID string, targetUserID string) (*HouseholdResponse, error)
	LeaveHousehold(ctx context.Context, requesterID string, householdID string) error
	SetDefaultHousehold(ctx context.Context, requesterID string, householdID string) error
	CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error)
	ListInvites(ctx context.Context, requesterID string, householdID string) ([]InviteResponse, error)
	RevokeInvite(ctx context.Context, requesterID string, householdID string, token string) error
	JoinHousehold(ctx context.Context, claims *middleware.UserClaims, token string) (*HouseholdResponse, error)
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

// requireRole returns the requester's role in the household, or
// ErrUnauthorizedHouseholdAccess if they are not a member or their role is
// not one of allowed (an empty allowed list accepts any member).
func (s *service) requireRole(ctx context.Context, householdID, requesterID string, allowed ...HouseholdRole) (HouseholdRole, error) {
	role, err := s.repo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return "", err
	}
	if len(allowed) == 0 {
		return role, nil
	}
	for _, a := range allowed {
		if role == a {
			return role, nil
		}
	}
	return "", ErrUnauthorizedHouseholdAccess
}
