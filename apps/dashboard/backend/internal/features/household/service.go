package household

import (
	"context"
	"fmt"
	"log/slog"

	"golang.org/x/sync/errgroup"
)

// Service business logic contract for households.
type Service interface {
	CreateHousehold(ctx context.Context, userID string, dto CreateHouseholdDTO) (*Household, error)
	GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponseDTO, error)
	AddMember(ctx context.Context, requesterID string, householdID string, dto AddMemberDTO) error
}

type service struct {
	repo Repository
	log  *slog.Logger
}

// NewService creates a household service instance.
func NewService(repo Repository, log *slog.Logger) Service {
	return &service{
		repo: repo,
		log:  log,
	}
}

func (s *service) CreateHousehold(ctx context.Context, userID string, dto CreateHouseholdDTO) (*Household, error) {
	h := &Household{
		Name:    dto.Name,
		Slug:    dto.Slug,
		OwnerID: userID,
	}

	if err := s.repo.Create(ctx, h); err != nil {
		return nil, err
	}

	s.log.Info("created household", slog.String("id", h.ID), slog.String("owner_id", userID))
	return h, nil
}

func (s *service) GetUserHouseholds(ctx context.Context, userID string) ([]HouseholdResponseDTO, error) {
	households, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if len(households) == 0 {
		return []HouseholdResponseDTO{}, nil
	}

	// Use errgroup for parallel fetching of member roles concurrently
	results := make([]HouseholdResponseDTO, len(households))
	g, gCtx := errgroup.WithContext(ctx)

	for i, h := range households {
		index := i
		item := h
		g.Go(func() error {
			role, err := s.repo.GetMemberRole(gCtx, item.ID, userID)
			if err != nil {
				return fmt.Errorf("failed to fetch role for household %s: %w", item.ID, err)
			}
			results[index] = ToResponse(item, string(role))
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *service) AddMember(ctx context.Context, requesterID string, householdID string, dto AddMemberDTO) error {
	role, err := s.repo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}

	if role != RoleOwner && role != RoleAdmin {
		return ErrUnauthorizedHouseholdAccess
	}

	member := &Member{
		HouseholdID: householdID,
		UserID:      dto.UserID,
		Role:        HouseholdRole(dto.Role),
	}

	return s.repo.AddMember(ctx, member)
}
