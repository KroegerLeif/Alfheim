package household

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"alfheim/household/internal/shared/middleware"
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

// validateHouseholdName trims and checks a household name.
func validateHouseholdName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > maxHouseholdNameLength {
		return "", ErrInvalidHouseholdName
	}
	return name, nil
}

func (s *service) CreateHousehold(ctx context.Context, claims *middleware.UserClaims, req CreateHouseholdRequest) (*HouseholdResponse, error) {
	name, err := validateHouseholdName(req.Name)
	if err != nil {
		return nil, err
	}

	slug := req.Slug
	if slug == "" {
		slug = name
	}
	slug = formatSlug(slug)
	if slug == "" || len(slug) > maxHouseholdNameLength {
		return nil, fmt.Errorf("%w: cannot derive a slug", ErrInvalidHouseholdName)
	}

	h := &Household{
		ID:      uuid.NewString(),
		Name:    name,
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
	if defaultID, err := s.repo.GetDefaultHouseholdID(ctx, claims.Subject); err == nil {
		resp.IsDefault = defaultID == h.ID
	}
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

	defaultID, err := s.repo.GetDefaultHouseholdID(ctx, userID)
	if err != nil {
		return nil, err
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
			results[index].IsDefault = item.ID == defaultID
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *service) GetHouseholdDetails(ctx context.Context, requesterID string, householdID string) (*HouseholdResponse, error) {
	// Membership is checked first so non-members get a deterministic 403 and
	// learn nothing about the household.
	role, err := s.requireRole(ctx, householdID, requesterID)
	if err != nil {
		return nil, err
	}

	var (
		h         *Household
		members   []*Member
		defaultID string
	)

	g, gCtx := errgroup.WithContext(ctx)

	// Fetch household entity, member list and default flag in parallel
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
		defaultID, err = s.repo.GetDefaultHouseholdID(gCtx, requesterID)
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
	resp.IsDefault = defaultID == householdID
	return &resp, nil
}

func (s *service) UpdateHouseholdAddress(ctx context.Context, requesterID string, householdID string, req UpdateHouseholdAddressRequest) error {
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return err
	}

	return s.repo.UpdateHouseholdAddress(ctx, householdID, req.Street, req.Zip, req.City, req.Country, req.Latitude, req.Longitude)
}

func (s *service) RenameHousehold(ctx context.Context, requesterID string, householdID string, req RenameHouseholdRequest) (*HouseholdResponse, error) {
	name, err := validateHouseholdName(req.Name)
	if err != nil {
		return nil, err
	}
	if _, err := s.requireRole(ctx, householdID, requesterID, RoleOwner, RoleAdmin); err != nil {
		return nil, err
	}
	if err := s.repo.RenameHousehold(ctx, householdID, name); err != nil {
		return nil, err
	}
	s.log.Info("renamed household", slog.String("household_id", householdID), slog.String("user_id", requesterID))
	return s.GetHouseholdDetails(ctx, requesterID, householdID)
}

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

func (s *service) SetDefaultHousehold(ctx context.Context, requesterID string, householdID string) error {
	if _, err := s.requireRole(ctx, householdID, requesterID); err != nil {
		return err
	}
	return s.repo.SetDefaultHouseholdTx(ctx, requesterID, householdID)
}
