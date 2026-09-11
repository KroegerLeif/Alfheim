package profile

import (
	"context"
	"errors"
	"log/slog"

	"alfheim/dashboard/internal/shared/middleware"
)

// Service defines domain logic for user profile syncing and management.
type Service interface {
	SyncProfileFromClaims(ctx context.Context, claims *middleware.UserClaims) (*Profile, error)
	GetProfileByID(ctx context.Context, id string) (*Profile, error)
	UpdateProfile(ctx context.Context, id string, dto UpdateDTO) (*Profile, error)
}

type service struct {
	repo Repository
	log  *slog.Logger
}

// NewService creates a profile service instance.
func NewService(repo Repository, log *slog.Logger) Service {
	return &service{
		repo: repo,
		log:  log,
	}
}

// SyncProfileFromClaims reconciles the local profile store with the verified OIDC
// token claims, performing Just-In-Time provisioning on first sign-in.
func (s *service) SyncProfileFromClaims(ctx context.Context, claims *middleware.UserClaims) (*Profile, error) {
	existing, err := s.repo.GetByID(ctx, claims.Subject)
	if err != nil && !errors.Is(err, ErrProfileNotFound) {
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

	// Case 2: JIT (Just-In-Time) provisioning from verified token claims
	newProfile := &Profile{
		ID:        claims.Subject,
		Email:     claims.Email,
		Username:  claims.PreferredUsername,
		FirstName: claims.GivenName,
		LastName:  claims.FamilyName,
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

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}

	s.log.Info("successfully updated user profile", slog.String("user_id", id))
	return p, nil
}
