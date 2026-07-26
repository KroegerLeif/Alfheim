package apps

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"golang.org/x/sync/errgroup"
)

// Service defines domain logic contract for the application catalog and permission routing.
type Service interface {
	GetPermittedApps(ctx context.Context, userRealmRoles []string, householdRole string) (*AppCatalogResponse, error)
	CreateApp(ctx context.Context, req CreateAppRequest) (*AppDTO, error)
	UpdateApp(ctx context.Context, id string, req UpdateAppRequest) (*AppDTO, error)
}

type service struct {
	repo Repository
	log  *slog.Logger
}

// NewService initializes app catalog service.
func NewService(repo Repository, log *slog.Logger) Service {
	return &service{
		repo: repo,
		log:  log,
	}
}

func (s *service) GetPermittedApps(ctx context.Context, userRealmRoles []string, householdRole string) (*AppCatalogResponse, error) {
	var activeApps []*AppItem

	g, gCtx := errgroup.WithContext(ctx)

	// Fetch active apps from repository
	g.Go(func() error {
		var err error
		activeApps, err = s.repo.GetActiveApps(gCtx)
		if err != nil {
			return fmt.Errorf("failed to fetch active apps: %w", err)
		}
		return nil
	})

	// Concurrently attempt to seed default apps if catalog is unpopulated
	g.Go(func() error {
		if err := s.repo.SeedDefaultApps(gCtx); err != nil {
			s.log.Debug("seed default apps notice", slog.String("error", err.Error()))
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	response := &AppCatalogResponse{
		Internal: make([]AppDTO, 0),
		External: make([]AppDTO, 0),
	}

	for _, item := range activeApps {
		if hasPermission(item.RequiredRole, userRealmRoles, householdRole) {
			dto := ToDTO(item)
			if item.IsExternal || item.Category == CategoryExternal {
				response.External = append(response.External, dto)
			} else {
				response.Internal = append(response.Internal, dto)
			}
			response.Total++
		}
	}

	return response, nil
}

func (s *service) CreateApp(ctx context.Context, req CreateAppRequest) (*AppDTO, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = strings.TrimSpace(req.Name)
	}

	url := strings.TrimSpace(req.URL)
	if url == "" {
		url = strings.TrimSpace(req.AppURL)
	}

	if title == "" {
		return nil, errors.New("app title or name is required")
	}
	if url == "" {
		return nil, errors.New("app url is required")
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = strings.TrimSpace(req.IconURL)
	}
	if icon == "" {
		icon = "grid_view"
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		if req.IsExternal {
			category = "external"
		} else {
			category = "internal"
		}
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "active"
	}

	role := strings.ToUpper(strings.TrimSpace(req.RequiredRole))
	if role == "" {
		role = "MEMBER"
	}

	reg := regexp.MustCompile("[^a-z0-9]+")
	slug := strings.Trim(reg.ReplaceAllString(strings.ToLower(title), "-"), "-")

	item := &AppItem{
		Name:         title,
		Title:        title,
		Slug:         slug,
		Description:  req.Description,
		IconURL:      icon,
		Icon:         icon,
		AppURL:       url,
		URL:          url,
		Category:     AppCategory(category),
		RequiredRole: AppRole(role),
		IsActive:     true,
		IsExternal:   req.IsExternal || category == "external",
		Status:       status,
		IsDefault:    false,
		DisplayOrder: 99,
	}

	if err := s.repo.CreateApp(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to create catalog app: %w", err)
	}

	dto := ToDTO(item)
	return &dto, nil
}

func (s *service) UpdateApp(ctx context.Context, id string, req UpdateAppRequest) (*AppDTO, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("app id is required")
	}

	app, err := s.repo.GetAppByID(ctx, id)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = strings.TrimSpace(req.Name)
	}
	if title != "" {
		app.Name = title
		app.Title = title
		reg := regexp.MustCompile("[^a-z0-9]+")
		app.Slug = strings.Trim(reg.ReplaceAllString(strings.ToLower(title), "-"), "-")
	}

	if req.Description != "" {
		app.Description = req.Description
	}

	url := strings.TrimSpace(req.URL)
	if url == "" {
		url = strings.TrimSpace(req.AppURL)
	}
	if url != "" {
		app.AppURL = url
		app.URL = url
	}

	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = strings.TrimSpace(req.IconURL)
	}
	if icon != "" {
		app.IconURL = icon
		app.Icon = icon
	}

	app.IsExternal = req.IsExternal
	if req.IsExternal {
		app.Category = CategoryExternal
	} else {
		app.Category = CategoryInternal
	}

	if req.Status != "" {
		app.Status = strings.ToLower(strings.TrimSpace(req.Status))
	}

	if err := s.repo.UpdateApp(ctx, app); err != nil {
		return nil, fmt.Errorf("failed to update catalog app %s: %w", id, err)
	}

	dto := ToDTO(app)
	return &dto, nil
}

func hasPermission(requiredRole AppRole, realmRoles []string, householdRole string) bool {
	// Realm admins always bypass app role checks
	for _, r := range realmRoles {
		if strings.EqualFold(r, "admin") || strings.EqualFold(r, "loeger_admin") {
			return true
		}
	}

	req := strings.ToUpper(string(requiredRole))
	hhRole := strings.ToUpper(householdRole)

	switch req {
	case "OWNER":
		return hhRole == "OWNER"
	case "ADMIN":
		return hhRole == "ADMIN" || hhRole == "OWNER"
	case "MEMBER", "":
		return true
	default:
		return true
	}
}
