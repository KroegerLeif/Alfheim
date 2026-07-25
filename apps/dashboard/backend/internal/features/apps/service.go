package apps

import (
	"context"
	"log/slog"
)

// Service domain logic contract for application catalog routing.
type Service interface {
	GetAppCatalog(ctx context.Context, userRoles []string) ([]AppResponseDTO, error)
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

func (s *service) GetAppCatalog(ctx context.Context, userRoles []string) ([]AppResponseDTO, error) {
	activeApps, err := s.repo.ListActiveApps(ctx)
	if err != nil {
		return nil, err
	}

	var allowed []AppResponseDTO
	for _, app := range activeApps {
		if isAllowed(app.RequiredRole, userRoles) {
			allowed = append(allowed, ToResponse(app))
		}
	}

	return allowed, nil
}

func isAllowed(requiredRole string, userRoles []string) bool {
	if requiredRole == "" || requiredRole == "MEMBER" {
		return true
	}
	for _, r := range userRoles {
		if r == requiredRole || r == "admin" || r == "loeger_admin" {
			return true
		}
	}
	return false
}
