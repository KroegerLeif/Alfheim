package profile

import (
	"context"
	"errors"
	"log/slog"

	"github.com/Nerzal/gocloak/v13"
	"golang.org/x/sync/errgroup"
	"alfheim/dashboard/internal/shared/keycloak"
	"alfheim/dashboard/internal/shared/middleware"
)

// Service defines domain logic for user profile syncing and management.
type Service interface {
	SyncProfileFromClaims(ctx context.Context, claims *middleware.UserClaims) (*Profile, error)
	GetProfileByID(ctx context.Context, id string) (*Profile, error)
	UpdateProfile(ctx context.Context, id string, dto UpdateDTO) (*Profile, error)
}

type service struct {
	repo           Repository
	keycloakClient *keycloak.Client
	log            *slog.Logger
}

// NewService creates a profile service instance.
func NewService(repo Repository, keycloakClient *keycloak.Client, log *slog.Logger) Service {
	return &service{
		repo:           repo,
		keycloakClient: keycloakClient,
		log:            log,
	}
}

func (s *service) SyncProfileFromClaims(ctx context.Context, claims *middleware.UserClaims) (*Profile, error) {
	var (
		existing *Profile
		getErr   error
		kcUser   *gocloak.User
	)

	g, gCtx := errgroup.WithContext(ctx)

	// Concurrently query database and Keycloak Admin API (if enabled)
	g.Go(func() error {
		existing, getErr = s.repo.GetByID(gCtx, claims.Subject)
		if errors.Is(getErr, ErrProfileNotFound) {
			return nil // NotFound is an expected condition for JIT creation
		}
		return getErr
	})

	if s.keycloakClient != nil {
		g.Go(func() error {
			user, err := s.keycloakClient.GetUserByID(gCtx, claims.Subject)
			if err == nil {
				kcUser = user
			} else {
				s.log.Debug("keycloak user admin query skipped/failed", slog.String("error", err.Error()))
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil && !errors.Is(err, ErrProfileNotFound) {
		return nil, err
	}

	// Case 1: Profile already exists in DB
	if existing != nil {
		updated := false
		if claims.Email != "" && existing.Email != claims.Email {
			existing.Email = claims.Email
			updated = true
		}
		if claims.PreferredUsername != "" && existing.Username != claims.PreferredUsername {
			existing.Username = claims.PreferredUsername
			updated = true
		}
		if claims.GivenName != "" && existing.FirstName != claims.GivenName {
			existing.FirstName = claims.GivenName
			updated = true
		}
		if claims.FamilyName != "" && existing.LastName != claims.FamilyName {
			existing.LastName = claims.FamilyName
			updated = true
		}

		if updated {
			if err := s.repo.Upsert(ctx, existing); err != nil {
				return nil, err
			}
			s.log.Info("synced existing profile with updated oidc claims", slog.String("user_id", existing.ID))
		}
		return existing, nil
	}

	// Case 2: JIT (Just-In-Time) provisioning
	newProfile := &Profile{
		ID:        claims.Subject,
		Email:     claims.Email,
		Username:  claims.PreferredUsername,
		FirstName: claims.GivenName,
		LastName:  claims.FamilyName,
	}

	// Enrich from Keycloak Admin API if available
	if kcUser != nil {
		if kcUser.FirstName != nil && *kcUser.FirstName != "" {
			newProfile.FirstName = *kcUser.FirstName
		}
		if kcUser.LastName != nil && *kcUser.LastName != "" {
			newProfile.LastName = *kcUser.LastName
		}
		if kcUser.Email != nil && *kcUser.Email != "" {
			newProfile.Email = *kcUser.Email
		}
	}

	if err := s.repo.Upsert(ctx, newProfile); err != nil {
		return nil, err
	}

	s.log.Info("created new user profile via JIT provisioning", slog.String("user_id", newProfile.ID))
	return newProfile, nil
}

func (s *service) GetProfileByID(ctx context.Context, id string) (*Profile, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *service) UpdateProfile(ctx context.Context, id string, dto UpdateDTO) (*Profile, error) {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	p.FirstName = dto.FirstName
	p.LastName = dto.LastName
	p.AvatarURL = dto.AvatarURL

	g, gCtx := errgroup.WithContext(ctx)

	// Update local PostgreSQL database
	g.Go(func() error {
		return s.repo.Update(gCtx, p)
	})

	// Concurrently sync profile update to Keycloak Admin API if client is available
	if s.keycloakClient != nil {
		g.Go(func() error {
			kcUser := gocloak.User{
				ID:        gocloak.StringP(id),
				FirstName: gocloak.StringP(dto.FirstName),
				LastName:  gocloak.StringP(dto.LastName),
			}
			if err := s.keycloakClient.UpdateUser(gCtx, kcUser); err != nil {
				s.log.Warn("failed to propagate profile update to keycloak admin api",
					slog.String("user_id", id),
					slog.String("error", err.Error()),
				)
				// Do not block local update on Keycloak transient error
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	s.log.Info("successfully updated user profile", slog.String("user_id", id))
	return p, nil
}
