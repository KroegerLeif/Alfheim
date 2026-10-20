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

const (
	defaultInviteTTL  = 24 * time.Hour
	maxInviteTTL      = 30 * 24 * time.Hour
	defaultInviteUses = 1
	maxInviteUses     = 100
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

	requesterRole, err := s.requireRole(ctx, req.HouseholdID, requesterID, RoleOwner, RoleAdmin)
	if err != nil {
		return nil, err
	}

	// Granting ADMIN is reserved to the owner (see UpdateMemberRole); otherwise
	// an admin could mint admin invites for an accomplice account.
	if targetRole == RoleAdmin && requesterRole != RoleOwner {
		return nil, ErrUnauthorizedHouseholdAccess
	}

	ttl, maxUses, err := inviteLimits(req)
	if err != nil {
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
	// The plaintext token is returned to the creator exactly once; the
	// repository persists only its SHA-256 hash.
	token := hex.EncodeToString(tokenBytes)

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

// inviteLimits applies the defaults for unset (zero) values and rejects negative
// or out-of-range ones. The bounds are checked on the raw integers before any
// multiplication so a huge ttl_minutes cannot overflow time.Duration.
func inviteLimits(req CreateInviteRequest) (time.Duration, int, error) {
	ttl := defaultInviteTTL
	if req.TTLMinutes != 0 {
		if req.TTLMinutes < 0 || req.TTLMinutes > int(maxInviteTTL/time.Minute) {
			return 0, 0, ErrInvalidInviteParams
		}
		ttl = time.Duration(req.TTLMinutes) * time.Minute
	}

	maxUses := defaultInviteUses
	if req.MaxUses != 0 {
		if req.MaxUses < 0 || req.MaxUses > maxInviteUses {
			return 0, 0, ErrInvalidInviteParams
		}
		maxUses = req.MaxUses
	}
	return ttl, maxUses, nil
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
