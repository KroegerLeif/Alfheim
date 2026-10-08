package household

import (
	"context"
	"errors"
	"log/slog"
	"strings"
)

// DeleteHousehold deletes a household (OWNER only).
func (s *service) DeleteHousehold(ctx context.Context, requesterID string, householdID string) error {
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner); err != nil {
		return err
	}
	if err := s.repo.DeleteHousehold(ctx, householdID); err != nil {
		return err
	}
	s.log.Info("deleted household", slog.String("household_id", householdID), slog.String("user_id", requesterID))
	return nil
}

// TransferOwnership hands the household to another member (OWNER only); the
// previous owner becomes ADMIN.
func (s *service) TransferOwnership(ctx context.Context, requesterID string, householdID string, targetUserID string) (*HouseholdResponse, error) {
	targetUserID = strings.TrimSpace(targetUserID)
	if targetUserID == "" || targetUserID == requesterID {
		return nil, ErrInvalidTransferTarget
	}
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner); err != nil {
		return nil, err
	}
	if _, err := s.repo.GetMemberRole(ctx, householdID, targetUserID); err != nil {
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			return nil, ErrMemberNotFound
		}
		return nil, err
	}
	if err := s.repo.TransferOwnershipTx(ctx, householdID, requesterID, targetUserID); err != nil {
		return nil, err
	}
	s.log.Info("transferred household ownership",
		slog.String("household_id", householdID),
		slog.String("from_user_id", requesterID),
		slog.String("to_user_id", targetUserID))
	return s.GetHouseholdDetails(ctx, requesterID, householdID)
}

// SetDefaultHousehold marks one of the caller's households as their default.
func (s *service) SetDefaultHousehold(ctx context.Context, requesterID string, householdID string) error {
	if _, err := s.requireRole(ctx, householdID, requesterID); err != nil {
		return err
	}
	return s.repo.SetDefaultHouseholdTx(ctx, requesterID, householdID)
}
