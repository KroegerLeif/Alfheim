package contact

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"loeger-os/dashboard/internal/features/household"
)

// Service coordinates business actions on contacts and contact categories.
type Service interface {
	CreateCategory(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error)
	GetCategories(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error)
	UpdateCategory(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error)
	DeleteCategory(ctx context.Context, requesterID, householdID, catID string) error

	CreateContact(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error)
	GetContacts(ctx context.Context, requesterID, householdID string) ([]*Contact, error)
	UpdateContact(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error)
	DeleteContact(ctx context.Context, requesterID, householdID, contactID string) error
}

type service struct {
	repo          Repository
	householdRepo household.Repository
	log           *slog.Logger
}

// NewService constructs a Contact Service instance.
func NewService(repo Repository, householdRepo household.Repository, log *slog.Logger) Service {
	return &service{
		repo:          repo,
		householdRepo: householdRepo,
		log:           log,
	}
}

func (s *service) checkRole(ctx context.Context, householdID, requesterID string, allowedRoles ...household.HouseholdRole) error {
	role, err := s.householdRepo.GetMemberRole(ctx, householdID, requesterID)
	if err != nil {
		return err
	}
	for _, allowed := range allowedRoles {
		if role == allowed {
			return nil
		}
	}
	return household.ErrUnauthorizedHouseholdAccess
}

func (s *service) CreateCategory(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin); err != nil {
		return nil, err
	}
	if req.Name == "" {
		return nil, fmt.Errorf("category name is required")
	}
	cat := &ContactCategory{
		ID:          uuid.NewString(),
		HouseholdID: householdID,
		Name:        req.Name,
		Icon:        req.Icon,
		Color:       req.Color,
	}
	if err := s.repo.CreateCategory(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *service) GetCategories(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin, household.RoleMember, household.RoleGuest); err != nil {
		return nil, err
	}
	return s.repo.GetCategories(ctx, householdID)
}

func (s *service) UpdateCategory(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin); err != nil {
		return nil, err
	}
	cat, err := s.repo.GetCategoryByID(ctx, catID)
	if err != nil {
		return nil, err
	}
	if cat.HouseholdID != householdID {
		return nil, household.ErrUnauthorizedHouseholdAccess
	}
	if req.Name == "" {
		return nil, fmt.Errorf("category name is required")
	}
	cat.Name = req.Name
	cat.Icon = req.Icon
	cat.Color = req.Color
	if err := s.repo.UpdateCategory(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *service) DeleteCategory(ctx context.Context, requesterID, householdID, catID string) error {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin); err != nil {
		return err
	}
	cat, err := s.repo.GetCategoryByID(ctx, catID)
	if err != nil {
		return err
	}
	if cat.HouseholdID != householdID {
		return household.ErrUnauthorizedHouseholdAccess
	}
	return s.repo.DeleteCategory(ctx, catID)
}

func (s *service) CreateContact(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin, household.RoleMember); err != nil {
		return nil, err
	}
	if req.Name == "" {
		return nil, fmt.Errorf("contact name is required")
	}

	if req.CategoryID != nil && *req.CategoryID != "" {
		cat, err := s.repo.GetCategoryByID(ctx, *req.CategoryID)
		if err != nil {
			return nil, err
		}
		if cat.HouseholdID != householdID {
			return nil, fmt.Errorf("contact category does not belong to the household")
		}
	}

	c := &Contact{
		ID:          uuid.NewString(),
		HouseholdID: householdID,
		CategoryID:  req.CategoryID,
		Name:        req.Name,
		Phone:       req.Phone,
		Email:       req.Email,
		Address:     req.Address,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Description: req.Description,
		Links:       req.Links,
		Icon:        req.Icon,
		AvatarURL:   req.AvatarURL,
	}
	if c.Links == nil {
		c.Links = []string{}
	}
	if err := s.repo.CreateContact(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) GetContacts(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin, household.RoleMember, household.RoleGuest); err != nil {
		return nil, err
	}
	return s.repo.GetContacts(ctx, householdID)
}

func (s *service) UpdateContact(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin, household.RoleMember); err != nil {
		return nil, err
	}
	c, err := s.repo.GetContactByID(ctx, contactID)
	if err != nil {
		return nil, err
	}
	if c.HouseholdID != householdID {
		return nil, household.ErrUnauthorizedHouseholdAccess
	}
	if req.Name == "" {
		return nil, fmt.Errorf("contact name is required")
	}

	if req.CategoryID != nil && *req.CategoryID != "" {
		cat, err := s.repo.GetCategoryByID(ctx, *req.CategoryID)
		if err != nil {
			return nil, err
		}
		if cat.HouseholdID != householdID {
			return nil, fmt.Errorf("contact category does not belong to the household")
		}
	}

	c.CategoryID = req.CategoryID
	c.Name = req.Name
	c.Phone = req.Phone
	c.Email = req.Email
	c.Address = req.Address
	c.Latitude = req.Latitude
	c.Longitude = req.Longitude
	c.Description = req.Description
	c.Links = req.Links
	c.Icon = req.Icon
	c.AvatarURL = req.AvatarURL
	if c.Links == nil {
		c.Links = []string{}
	}

	if err := s.repo.UpdateContact(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *service) DeleteContact(ctx context.Context, requesterID, householdID, contactID string) error {
	if err := s.checkRole(ctx, householdID, requesterID, household.RoleOwner, household.RoleAdmin, household.RoleMember); err != nil {
		return err
	}
	c, err := s.repo.GetContactByID(ctx, contactID)
	if err != nil {
		return err
	}
	if c.HouseholdID != householdID {
		return household.ErrUnauthorizedHouseholdAccess
	}
	return s.repo.DeleteContact(ctx, contactID)
}
