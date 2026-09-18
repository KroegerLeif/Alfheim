package household

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"alfheim/household/internal/shared/middleware"
)

func (s *service) CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
	targetRole := RoleMember
	if req.Role != "" {
		role, err := ParseRole(req.Role)
		if err != nil {
			return nil, err
		}
		targetRole = role
	}

	if _, err := s.requireRole(ctx, req.HouseholdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return nil, err
	}

	// Nobody can invite someone as OWNER: that would let an ADMIN escalate
	// (by redeeming their own invite on a second account) and there is exactly
	// one owner, changed only via transfer-ownership.
	if targetRole == RoleOwner {
		return nil, ErrOwnerRoleNotAssignable
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("failed to generate secure invite token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	ttl := 24 * time.Hour
	if req.TTLMinutes > 0 {
		ttl = time.Duration(req.TTLMinutes) * time.Minute
	}

	maxUses := 1
	if req.MaxUses > 0 {
		maxUses = req.MaxUses
	}

	invite := &Invite{
		Token:       token,
		HouseholdID: req.HouseholdID,
		InviterID:   requesterID,
		Role:        targetRole,
		ExpiresAt:   time.Now().Add(ttl),
		MaxUses:     maxUses,
		Uses:        0,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateInvite(ctx, invite); err != nil {
		return nil, err
	}

	s.log.Info("created household invite token", slog.String("household_id", req.HouseholdID), slog.String("inviter_id", requesterID))
	resp := ToInviteResponse(invite)
	return &resp, nil
}

func (s *service) ListInvites(ctx context.Context, requesterID string, householdID string) ([]InviteResponse, error) {
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return nil, err
	}
	invites, err := s.repo.ListActiveInvites(ctx, householdID)
	if err != nil {
		return nil, err
	}
	res := make([]InviteResponse, len(invites))
	for i, inv := range invites {
		res[i] = ToInviteResponse(inv)
	}
	return res, nil
}

func (s *service) RevokeInvite(ctx context.Context, requesterID string, householdID string, token string) error {
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return err
	}
	if err := s.repo.DeleteInvite(ctx, householdID, token); err != nil {
		return err
	}
	s.log.Info("revoked household invite", slog.String("household_id", householdID), slog.String("user_id", requesterID))
	return nil
}

// JoinHousehold redeems an invite token atomically (see RedeemInviteTx).
func (s *service) JoinHousehold(ctx context.Context, claims *middleware.UserClaims, token string) (*HouseholdResponse, error) {
	invite, err := s.repo.RedeemInviteTx(ctx, token, claims.Subject, claims.Email, claims.PreferredUsername)
	if err != nil {
		return nil, err
	}

	s.log.Info("user joined household via invite", slog.String("user_id", claims.Subject), slog.String("household_id", invite.HouseholdID))
	return s.GetHouseholdDetails(ctx, claims.Subject, invite.HouseholdID)
}
