package profile

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"loeger-os/dashboard/internal/shared/keycloak"
	"loeger-os/dashboard/internal/shared/middleware"
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
	existing, err := s.repo.GetByID(ctx, claims.Subject)
	if err == nil {
		// Profile exists, update cached claims if changed
		if existing.Email != claims.Email || existing.FirstName != claims.GivenName || existing.LastName != claims.FamilyName {
			existing.Email = claims.Email
			existing.Username = claims.PreferredUsername
			existing.FirstName = claims.GivenName
			existing.LastName = claims.FamilyName
			if err := s.repo.Upsert(ctx, existing); err != nil {
				return nil, err
			}
		}
		return existing, nil
	}

	if !errors.Is(err, ErrProfileNotFound) {
		return nil, err
	}

	// Profile does not exist yet; create from JWT claims
	newProfile := &Profile{
		ID:        claims.Subject,
		Email:     claims.Email,
		Username:  claims.PreferredUsername,
		FirstName: claims.GivenName,
		LastName:  claims.FamilyName,
	}

	// Optionally enrich from Keycloak Admin API if client configured
	if s.keycloakClient != nil {
		kcUser, err := s.keycloakClient.GetUserByID(ctx, claims.Subject)
		if err == nil && kcUser != nil {
			if kcUser.FirstName != nil {
				newProfile.FirstName = *kcUser.FirstName
			}
			if kcUser.LastName != nil {
				newProfile.LastName = *kcUser.LastName
			}
		} else {
			s.log.Debug("keycloak user admin enrichment skipped or failed", slog.String("error", fmt.Sprintf("%v", err)))
		}
	}

	if err := s.repo.Upsert(ctx, newProfile); err != nil {
		return nil, err
	}

	s.log.Info("created new user profile from oidc claims", slog.String("user_id", newProfile.ID))
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

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}

	return p, nil
}
