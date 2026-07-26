package household

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"golang.org/x/sync/errgroup"
)

// Service defines business logic for household management, authorization, and invitations.
type Service interface {
	CreateHousehold(ctx context.Context, userID string, req CreateHouseholdRequest) (*HouseholdResponse, error)
	GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponse, error)
	GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error)
	CreateInvite(ctx context.Context, requesterID string, req CreateInviteRequest) (*InviteResponse, error)
	JoinHousehold(ctx context.Context, userID string, token string) (*HouseholdResponse, error)
	RemoveMember(ctx context.Context, requesterID string, householdID string, targetUserID string) error
	UpdateMemberRole(ctx context.Context, requesterID string, householdID string, targetUserID string, newRole HouseholdRole) error
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

func (s *service) CreateHousehold(ctx context.Context, userID string, req CreateHouseholdRequest) (*HouseholdResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("household name is required")
	}
	if req.Slug == "" {
		return nil, fmt.Errorf("household slug is required")
	}

	h := &Household{
		Name:    req.Name,
		Slug:    req.Slug,
		OwnerID: userID,
	}

	if err := s.repo.CreateHouseholdTx(ctx, h); err != nil {
		return nil, err
	}

	s.log.Info("created household", slog.String("id", h.ID), slog.String("owner_id", userID))

	resp := ToHouseholdResponse(h, string(RoleOwner), []MemberResponse{
		{
			HouseholdID: h.ID,
			UserID:      userID,
			Role:        string(RoleOwner),
			JoinedAt:    time.Now(),
		},
	})
	return &resp, nil
}

func (s *service) GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponse, error) {
	households, err := s.repo.GetHouseholdsByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if len(households) == 0 {
		return []HouseholdResponse{}, nil
	}

	// Fetch roles concurrently for each household using errgroup
	results := make([]HouseholdResponse, len(households))
	g, gCtx := errgroup.WithContext(ctx)

	for i, h := range households {
		index := i
		item := h
		g.Go(func() error {
			role, err := s.repo.GetMemberRole(gCtx, item.ID, userID)
			if err != nil {
				return fmt.Errorf("failed to fetch role for household %s: %w", item.ID, err)
			}
			members, err := s.repo.GetMembers(gCtx, item.ID)
			if err != nil {
				return fmt.Errorf("failed to fetch members for household %s: %w", item.ID, err)
			}
			memberResponses := make([]MemberResponse, len(members))
			for j, m := range members {
				memberResponses[j] = ToMemberResponse(m)
			}
			results[index] = ToHouseholdResponse(item, string(role), memberResponses)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *service) GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error) {
	var (
		h       *Household
		members []*Member
		role    HouseholdRole
	)

	g, gCtx := errgroup.WithContext(ctx)

	// Fetch household entity, member list, and requester role in parallel
	g.Go(func() error {
		var err error
		h, err = s.repo.GetHouseholdByID(gCtx, householdID)
		return err
	})

	g.Go(func() error {
		var err error
		members, err = s.repo.GetMembers(gCtx, householdID)
		return err
	})

	g.Go(func() error {
		var err error
		role, err = s.repo.GetMemberRole(gCtx, householdID, requesterID)
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	memberResponses := make([]MemberResponse, len(members))
	for i, m := range members {
		memberResponses[i] = ToMemberResponse(m)
	}

	resp := ToHouseholdResponse(h, string(role), memberResponses)
	return &resp, nil
}

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
