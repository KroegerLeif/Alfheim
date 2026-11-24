package launchers

import (
	"context"

	"github.com/google/uuid"
)

// Service manages the launchers of one household at a time. Callers pass the
// household confirmed by household.RequireHousehold; role checks happen in
// the HTTP layer (household.RequireHouseholdRole).
type Service interface {
	List(ctx context.Context, householdID uuid.UUID, limit, offset int) (Page, error)
	Create(ctx context.Context, householdID uuid.UUID, createdBy string, req LauncherRequest) (Launcher, error)
	Update(ctx context.Context, householdID, id uuid.UUID, req LauncherRequest) (Launcher, error)
	Delete(ctx context.Context, householdID, id uuid.UUID) error
}

type service struct {
	repo Repository
}

// NewService returns the launcher service on repo.
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) List(ctx context.Context, householdID uuid.UUID, limit, offset int) (Page, error) {
	return s.repo.List(ctx, householdID, limit, offset)
}

func (s *service) Create(ctx context.Context, householdID uuid.UUID, createdBy string, req LauncherRequest) (Launcher, error) {
	if err := req.Validate(); err != nil {
		return Launcher{}, err
	}
	l := fromRequest(req)
	l.HouseholdID = householdID
	l.CreatedBy = createdBy
	if err := s.repo.Create(ctx, &l); err != nil {
		return Launcher{}, err
	}
	return l, nil
}

func (s *service) Update(ctx context.Context, householdID, id uuid.UUID, req LauncherRequest) (Launcher, error) {
	if err := req.Validate(); err != nil {
		return Launcher{}, err
	}
	l := fromRequest(req)
	l.ID = id
	l.HouseholdID = householdID
	if err := s.repo.Update(ctx, &l); err != nil {
		return Launcher{}, err
	}
	return l, nil
}

func (s *service) Delete(ctx context.Context, householdID, id uuid.UUID) error {
	return s.repo.Delete(ctx, householdID, id)
}

// fromRequest copies a validated request; an empty icon becomes DefaultIcon.
func fromRequest(req LauncherRequest) Launcher {
	icon := req.Icon
	if icon == "" {
		icon = DefaultIcon
	}
	return Launcher{
		Title:        req.Title,
		URL:          req.URL,
		Icon:         icon,
		Description:  req.Description,
		DisplayOrder: req.DisplayOrder,
	}
}
