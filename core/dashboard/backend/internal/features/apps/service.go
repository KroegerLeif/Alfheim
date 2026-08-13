package apps

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

// Service defines domain logic contract for the 3-tier app & dashboard management architecture.
type Service interface {
	GetDashboardApps(ctx context.Context, userID string, userRoles []string) (*DashboardAppsResponse, error)
	GetUserPreferences(ctx context.Context, userID string) (*UserPreferences, error)
	UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*UserPreferences, error)
	CreateUserLink(ctx context.Context, userID string, req CreateUserLinkRequest) (*AppItem, error)
	UpdateUserLink(ctx context.Context, userID string, id string, req UpdateUserLinkRequest) (*AppItem, error)
	DeleteUserLink(ctx context.Context, userID string, id string) error
}

type service struct {
	repo        Repository
	stackLoader StackAppsLoader
	log         *slog.Logger
}

// NewService initializes 3-tier app service.
func NewService(repo Repository, stackLoader StackAppsLoader, log *slog.Logger) Service {
	return &service{
		repo:        repo,
		stackLoader: stackLoader,
		log:         log,
	}
}

func (s *service) GetDashboardApps(ctx context.Context, userID string, userRoles []string) (*DashboardAppsResponse, error) {
	// 1. Fetch user preferences (hidden Core Apps)
	prefs, err := s.repo.GetUserPreferences(ctx, userID)
	if err != nil {
		s.log.Warn("failed to fetch user preferences, falling back to empty preferences",
			slog.String("user_id", userID),
			slog.String("error", err.Error()),
		)
		prefs = &UserPreferences{UserID: userID, HiddenAppIDs: []string{}}
	}

	hiddenMap := make(map[string]bool)
	for _, id := range prefs.HiddenAppIDs {
		hiddenMap[strings.ToLower(id)] = true
	}

	// 2. Resolve Tier 1 Core Apps
	visibleCore := make([]AppItem, 0)
	allCore := make([]AppItem, 0, len(CoreApps))

	for _, app := range CoreApps {
		appCopy := app
		isHidden := hiddenMap[strings.ToLower(app.ID)] || hiddenMap[strings.ToLower(app.Slug)]
		appCopy.IsHidden = isHidden
		allCore = append(allCore, appCopy)

		if !isHidden {
			visibleCore = append(visibleCore, appCopy)
		}
	}

	// 3. Resolve Tier 2 Stack Apps from YAML loader
	stackYamlApps, err := s.stackLoader.LoadStackApps()
	if err != nil {
		s.log.Error("failed to load stack apps configuration", slog.String("error", err.Error()))
		stackYamlApps = []StackAppConfig{}
	}

	permittedStack := make([]AppItem, 0)
	for _, sa := range stackYamlApps {
		if hasStackPermission(sa.RequiredRoles, userRoles) {
			item := AppItem{
				ID:            sa.ID,
				Slug:          sa.Slug,
				Title:         sa.Title,
				Name:          sa.Title,
				Description:   sa.Description,
				Icon:          sa.Icon,
				IconURL:       sa.Icon,
				URL:           sa.URL,
				AppURL:        sa.URL,
				Category:      sa.Category,
				Tier:          TierStack,
				Status:        sa.Status,
				RequiredRoles: sa.RequiredRoles,
				DisplayOrder:  sa.DisplayOrder,
			}
			permittedStack = append(permittedStack, item)
		}
	}

	// 4. Resolve Tier 3 User Links from database
	dbUserLinks, err := s.repo.GetUserLinks(ctx, userID)
	if err != nil {
		s.log.Error("failed to load user links from database", slog.String("user_id", userID), slog.String("error", err.Error()))
		dbUserLinks = []*UserLink{}
	}

	userItems := make([]AppItem, 0, len(dbUserLinks))
	for _, ul := range dbUserLinks {
		item := AppItem{
			ID:           ul.ID,
			Slug:         ul.ID,
			Title:        ul.Title,
			Name:         ul.Title,
			Description:  ul.Description,
			Icon:         ul.Icon,
			IconURL:      ul.Icon,
			URL:          ul.URL,
			AppURL:       ul.URL,
			Category:     ul.Category,
			Tier:         TierUser,
			Status:       "active",
			IsCustom:     true,
			DisplayOrder: ul.DisplayOrder,
			CreatedAt:    ul.CreatedAt,
			UpdatedAt:    ul.UpdatedAt,
		}
		userItems = append(userItems, item)
	}

	total := len(visibleCore) + len(permittedStack) + len(userItems)

	return &DashboardAppsResponse{
		Core:        visibleCore,
		Stack:       permittedStack,
		User:        userItems,
		AllCore:     allCore,
		Preferences: *prefs,
		Total:       total,
	}, nil
}

func (s *service) GetUserPreferences(ctx context.Context, userID string) (*UserPreferences, error) {
	return s.repo.GetUserPreferences(ctx, userID)
}

func (s *service) UpdateUserPreferences(ctx context.Context, userID string, hiddenAppIDs []string) (*UserPreferences, error) {
	return s.repo.UpdateUserPreferences(ctx, userID, hiddenAppIDs)
}

func (s *service) CreateUserLink(ctx context.Context, userID string, req CreateUserLinkRequest) (*AppItem, error) {
	title := strings.TrimSpace(req.Title)
	url := strings.TrimSpace(req.URL)

	if title == "" || url == "" {
		return nil, ErrInvalidLinkInputs
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "link"
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "user"
	}

	link := &UserLink{
		UserID:       userID,
		Title:        title,
		URL:          url,
		Icon:         icon,
		Category:     category,
		Description:  strings.TrimSpace(req.Description),
		DisplayOrder: 99,
	}

	if err := s.repo.CreateUserLink(ctx, link); err != nil {
		return nil, fmt.Errorf("failed to create user link: %w", err)
	}

	item := &AppItem{
		ID:          link.ID,
		Slug:        link.ID,
		Title:       link.Title,
		Name:        link.Title,
		Description: link.Description,
		Icon:        link.Icon,
		IconURL:     link.Icon,
		URL:         link.URL,
		AppURL:      link.URL,
		Category:    link.Category,
		Tier:        TierUser,
		Status:      "active",
		IsCustom:    true,
		CreatedAt:   link.CreatedAt,
		UpdatedAt:   link.UpdatedAt,
	}

	return item, nil
}

func (s *service) UpdateUserLink(ctx context.Context, userID string, id string, req UpdateUserLinkRequest) (*AppItem, error) {
	link, err := s.repo.GetUserLinkByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if title := strings.TrimSpace(req.Title); title != "" {
		link.Title = title
	}
	if url := strings.TrimSpace(req.URL); url != "" {
		link.URL = url
	}
	if icon := strings.TrimSpace(req.Icon); icon != "" {
		link.Icon = icon
	}
	if category := strings.TrimSpace(req.Category); category != "" {
		link.Category = category
	}
	if req.Description != "" {
		link.Description = strings.TrimSpace(req.Description)
	}

	if err := s.repo.UpdateUserLink(ctx, link); err != nil {
		return nil, fmt.Errorf("failed to update user link %s: %w", id, err)
	}

	item := &AppItem{
		ID:          link.ID,
		Slug:        link.ID,
		Title:       link.Title,
		Name:        link.Title,
		Description: link.Description,
		Icon:        link.Icon,
		IconURL:     link.Icon,
		URL:         link.URL,
		AppURL:      link.URL,
		Category:    link.Category,
		Tier:        TierUser,
		Status:      "active",
		IsCustom:    true,
		CreatedAt:   link.CreatedAt,
		UpdatedAt:   link.UpdatedAt,
	}

	return item, nil
}

func (s *service) DeleteUserLink(ctx context.Context, userID string, id string) error {
	return s.repo.DeleteUserLink(ctx, id, userID)
}

func hasStackPermission(requiredRoles []string, userRoles []string) bool {
	// If no required roles specified, visible to all authenticated users
	if len(requiredRoles) == 0 {
		return true
	}

	// Realm admins bypass role checks
	for _, ur := range userRoles {
		if strings.EqualFold(ur, "admin") || strings.EqualFold(ur, "alfheim_admin") {
			return true
		}
	}

	// Match user roles with required roles
	for _, req := range requiredRoles {
		for _, ur := range userRoles {
			if strings.EqualFold(req, ur) {
				return true
			}
		}
	}

	return false
}
