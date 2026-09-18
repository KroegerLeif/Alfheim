package household

import (
	"context"
	"log/slog"
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
	if requesterID != targetUserID && !requesterRole.CanManage() {
		return ErrUnauthorizedHouseholdAccess
	}

	return s.repo.RemoveMember(ctx, householdID, targetUserID)
}

func (s *service) LeaveHousehold(ctx context.Context, requesterID string, householdID string) error {
	role, err := s.requireRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}
	if role == RoleOwner {
		return ErrOwnerCannotLeave
	}
	if err := s.repo.RemoveMember(ctx, householdID, requesterID); err != nil {
		return err
	}
	s.log.Info("user left household", slog.String("household_id", householdID), slog.String("user_id", requesterID))
	return nil
}

// UpdateMemberRole changes a non-owner member's role. OWNER can never be
// granted here (ADMINs must not escalate to OWNER, and owners hand over the
// household via transfer-ownership), and the owner's own role is immutable.
func (s *service) UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error {
	role, err := ParseRole(string(newRole))
	if err != nil {
		return err
	}

	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return err
	}

	if role == RoleOwner {
		return ErrOwnerRoleNotAssignable
	}

	h, err := s.repo.GetHouseholdByID(ctx, householdID)
	if err != nil {
		return err
	}

	if h.OwnerID == targetUserID {
		return ErrCannotChangeOwnerRole
	}

	return s.repo.UpdateMemberRole(ctx, householdID, targetUserID, role)
}
