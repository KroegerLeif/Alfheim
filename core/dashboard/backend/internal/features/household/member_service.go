package household

import (
	"context"
	"fmt"
)

func (s *service) RemoveMember(ctx context.Context, requesterID string, householdID string, targetUserID string) error {
	requesterRole, err := s.repo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}

	h, err := s.repo.GetHouseholdByID(ctx, householdID)
	if err != nil {
		return err
	}

	if h.OwnerID == targetUserID {
		return ErrCannotRemoveOwner
	}

	// Owner can remove anyone; Admin can remove Members; Users can remove themselves (leave)
	if requesterID != targetUserID && requesterRole != RoleOwner && requesterRole != RoleAdmin {
		return ErrUnauthorizedHouseholdAccess
	}

	return s.repo.RemoveMember(ctx, householdID, targetUserID)
}

func (s *service) UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error {
	requesterRole, err := s.repo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}

	if requesterRole != RoleOwner && requesterRole != RoleAdmin {
		return ErrUnauthorizedHouseholdAccess
	}

	h, err := s.repo.GetHouseholdByID(ctx, householdID)
	if err != nil {
		return err
	}

	if h.OwnerID == targetUserID {
		return fmt.Errorf("cannot change role of household owner")
	}

	return s.repo.UpdateMemberRole(ctx, householdID, targetUserID, newRole)
}
