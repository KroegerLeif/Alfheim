package household

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"alfheim/dashboard/internal/shared/middleware"
	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

func formatSlug(s string) string {
	var res []rune
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			res = append(res, r)
		} else if r == ' ' || r == '-' || r == '_' {
			if len(res) > 0 && res[len(res)-1] != '-' {
				res = append(res, '-')
			}
		}
	}
	str := string(res)
	str = strings.Trim(str, "-")
	return str
}

func (s *service) CreateHousehold(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("household name is required")
	}

	slug := req.Slug
	if slug == "" {
		slug = req.Name
	}
	slug = formatSlug(slug)
	if slug == "" {
		return nil, fmt.Errorf("invalid household name for slug generation")
	}

	h := &Household{
		ID:      uuid.NewString(),
		Name:    req.Name,
		Slug:    slug,
		OwnerID: claims.Subject,
	}

	if err := s.repo.CreateHouseholdTx(ctx, h, claims.Email, claims.PreferredUsername); err != nil {
		return nil, err
	}

	s.log.Info("created household", slog.String("id", h.ID), slog.String("owner_id", claims.Subject))

	resp := ToHouseholdResponse(h, string(RoleOwner), []MemberResponse{
		{
			HouseholdID: h.ID,
			UserID:      claims.Subject,
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

func (s *service) UpdateHouseholdAddress(ctx context.Context, requesterID string, householdID string, req UpdateHouseholdAddressRequest) error {
	role, err := s.repo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}

	if role != RoleOwner && role != RoleAdmin {
		return ErrUnauthorizedHouseholdAccess
	}

	return s.repo.UpdateHouseholdAddress(ctx, householdID, req.Street, req.Zip, req.City, req.Country, req.Latitude, req.Longitude)
}
