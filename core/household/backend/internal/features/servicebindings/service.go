package servicebindings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"slices"

	"github.com/google/uuid"

	"alfheim/household/internal/features/household"
)

// maxScopes bounds the scope list of one binding.
const maxScopes = 16

// scopePattern is "<app>:<action>", for example "chores:create_instance".
var scopePattern = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}:[a-z][a-z0-9_]{0,63}$`)

// MemberRoles reads household roles (satisfied by household.Repository).
type MemberRoles interface {
	GetMemberRole(ctx context.Context, householdID string, userID string) (household.HouseholdRole, error)
}

// Service manages service bindings. Every management call is authorized
// against household_members: only an OWNER or ADMIN of the household may act.
type Service struct {
	repo       Repository
	roles      MemberRoles
	principals Principals
	log        *slog.Logger
}

// NewService wires the service with its repository, the household role reader
// and the configured service principals.
func NewService(repo Repository, roles MemberRoles, principals Principals, log *slog.Logger) *Service {
	return &Service{repo: repo, roles: roles, principals: principals, log: log}
}

// Create binds req.PrincipalID to the household with req.Scopes, or replaces
// the scopes of an existing binding. created reports a new binding.
func (s *Service) Create(ctx context.Context, callerSub, householdID string, req CreateRequest) (Binding, bool, error) {
	hh, err := s.authorizeAdmin(ctx, callerSub, householdID)
	if err != nil {
		return Binding{}, false, err
	}
	if !s.principals.Contains(req.PrincipalID) {
		return Binding{}, false, ErrUnknownPrincipal
	}
	if !validScopes(req.Scopes) {
		return Binding{}, false, ErrInvalidScopes
	}
	if _, err := s.roles.GetMemberRole(ctx, hh, req.PrincipalID); err == nil {
		return Binding{}, false, ErrPrincipalIsMember
	} else if !errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		return Binding{}, false, err
	}

	b := Binding{PrincipalID: req.PrincipalID, HouseholdID: hh, Scopes: req.Scopes, CreatedBy: callerSub}
	created, err := s.repo.Upsert(ctx, &b)
	if err != nil {
		return Binding{}, false, err
	}
	s.log.Info("service binding saved",
		slog.String("household_id", hh), slog.String("principal_id", b.PrincipalID),
		slog.String("by", callerSub), slog.Bool("created", created))
	return b, created, nil
}

// List returns the household's bindings.
func (s *Service) List(ctx context.Context, callerSub, householdID string) ([]Binding, error) {
	hh, err := s.authorizeAdmin(ctx, callerSub, householdID)
	if err != nil {
		return nil, err
	}
	return s.repo.List(ctx, hh)
}

// Revoke deletes the binding; the principal loses access on its next request.
func (s *Service) Revoke(ctx context.Context, callerSub, householdID, principalID string) error {
	hh, err := s.authorizeAdmin(ctx, callerSub, householdID)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, hh, principalID); err != nil {
		return err
	}
	s.log.Info("service binding revoked",
		slog.String("household_id", hh), slog.String("principal_id", principalID), slog.String("by", callerSub))
	return nil
}

// Resolve returns the binding of a configured service principal to the
// household, or ErrNotFound. A binding whose principal was removed from the
// configuration no longer resolves.
func (s *Service) Resolve(ctx context.Context, householdID, principalID string) (Binding, error) {
	if !s.principals.Contains(principalID) {
		return Binding{}, ErrNotFound
	}
	return s.repo.Find(ctx, householdID, principalID)
}

// authorizeAdmin returns the normalized household id when callerSub is an
// OWNER or ADMIN of it, else ErrForbidden.
func (s *Service) authorizeAdmin(ctx context.Context, callerSub, householdID string) (string, error) {
	parsed, err := uuid.Parse(householdID)
	if err != nil {
		return "", ErrForbidden
	}
	hh := parsed.String()
	role, err := s.roles.GetMemberRole(ctx, hh, callerSub)
	if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
		return "", ErrForbidden
	}
	if err != nil {
		return "", fmt.Errorf("failed to check the caller's household role: %w", err)
	}
	if role != household.RoleOwner && role != household.RoleAdmin {
		return "", ErrForbidden
	}
	return hh, nil
}

func validScopes(scopes []string) bool {
	if len(scopes) == 0 || len(scopes) > maxScopes {
		return false
	}
	for i, scope := range scopes {
		if !scopePattern.MatchString(scope) || slices.Contains(scopes[:i], scope) {
			return false
		}
	}
	return true
}
