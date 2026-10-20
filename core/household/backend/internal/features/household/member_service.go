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

	// Users can always remove themselves (leave). Otherwise the owner can
	// remove anyone, while an admin can only remove MEMBER and GUEST: removing
	// an ADMIN is reserved to the owner so admins cannot evict each other.
	if requesterID != targetUserID {
		if !requesterRole.CanManage() {
			return ErrUnauthorizedHouseholdAccess
		}
		if requesterRole != RoleOwner {
			targetRole, err := s.repo.GetMemberRole(ctx, householdID, targetUserID)
			if err != nil {
				return err
			}
			if targetRole.CanManage() {
				return ErrUnauthorizedHouseholdAccess
			}
		}
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
// granted here (owners hand over the household via transfer-ownership) and the
// owner's own role is immutable. An ADMIN may only switch MEMBER and GUEST
// between each other; granting or revoking ADMIN is reserved to the owner so
// admins cannot escalate themselves or accomplices, nor demote other admins.
func (s *service) UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error {
	role, err := ParseRole(string(newRole))
	if err != nil {
		return err
	}

	requesterRole, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin)
	if err != nil {
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

	if requesterRole != RoleOwner {
		if role == RoleAdmin {
			return ErrUnauthorizedHouseholdAccess
		}
		targetRole, err := s.repo.GetMemberRole(ctx, householdID, targetUserID)
		if err != nil {
			return err
		}
		if targetRole == RoleAdmin {
			return ErrUnauthorizedHouseholdAccess
		}
	}

	return s.repo.UpdateMemberRole(ctx, householdID, targetUserID, role)
}
