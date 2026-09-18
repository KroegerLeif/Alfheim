package household

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"
)

func (s *service) CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error) {
	role, err := s.repo.GetMemberRole(ctx, req.HouseholdID, requesterID)
	if err != nil {
		return nil, err
	}

	if role != RoleOwner && role != RoleAdmin {
		return nil, ErrUnauthorizedHouseholdAccess
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

	targetRole := RoleMember
	if req.Role != "" {
		targetRole = HouseholdRole(req.Role)
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

func (s *service) JoinHousehold(ctx context.Context, userID string, token string) (*HouseholdResponse, error) {
	invite, err := s.repo.GetInviteByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	if !invite.IsValid() {
		return nil, ErrInviteExpiredOrInvalid
	}

	member := &Member{
		HouseholdID: invite.HouseholdID,
		UserID:      userID,
		Role:        invite.Role,
		JoinedAt:    time.Now(),
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	_ = s.repo.IncrementInviteUses(ctx, token)

	s.log.Info("user joined household via invite", slog.String("user_id", userID), slog.String("household_id", invite.HouseholdID))
	return s.GetHouseholdDetails(ctx, userID, invite.HouseholdID)
}
