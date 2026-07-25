package apps

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"golang.org/x/sync/errgroup"
)

// Service defines domain logic contract for the application catalog and permission routing.
type Service interface {
	GetPermittedApps(ctx context.Context, userRealmRoles []string, householdRole string) (*AppCatalogResponse, error)
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
			if item.Category == CategoryExternal {
				response.External = append(response.External, dto)
			} else {
				response.Internal = append(response.Internal, dto)
			}
			response.Total++
		}
	}

	return response, nil
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
