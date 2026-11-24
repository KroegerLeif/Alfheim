package household

import (
	"slices"

	"github.com/google/uuid"
)

// RoleService is the role the membership API reports for a household-bound
// service principal (#958). It is never a member role: RequireHousehold
// rejects it unless the route opts in with AllowServiceScopes.
const RoleService Role = "SERVICE"

// serviceMembership builds the answer for a service principal; ok is false for
// any other role. Its scopes are kept only for RoleService.
func serviceMembership(householdID uuid.UUID, userSub string, role Role, scopes []string) (Membership, bool) {
	if role != RoleService {
		return Membership{}, false
	}
	return Membership{HouseholdID: householdID, UserID: userSub, Role: role, Scopes: scopes}, true
}

// RequireOption customizes RequireHousehold for one route or route group.
type RequireOption func(*requireConfig)

type requireConfig struct {
	serviceScopes []string
}

// AllowServiceScopes opts a route in to household-bound service principals
// (#958): a caller with role RoleService passes RequireHousehold when its
// binding grants every scope listed here. Without this option, or with no
// scopes, service principals are always rejected with 403.
//
// Handlers behind such a route must not treat the caller as a member: check
// HouseholdContext.IsService before acting on the caller's own identity.
func AllowServiceScopes(scopes ...string) RequireOption {
	return func(c *requireConfig) {
		c.serviceScopes = append(c.serviceScopes, scopes...)
	}
}

func newRequireConfig(opts []RequireOption) requireConfig {
	var cfg requireConfig
	for _, opt := range opts {
		opt(&cfg)
	}
	return cfg
}

// admitsService reports whether a service principal holding granted may pass.
// It fails closed: a route that names no scope admits no service principal.
func (c requireConfig) admitsService(granted []string) bool {
	if len(c.serviceScopes) == 0 {
		return false
	}
	for _, scope := range c.serviceScopes {
		if !slices.Contains(granted, scope) {
			return false
		}
	}
	return true
}

// HasScope reports whether the caller is a service principal whose binding
// grants scope. It is always false for a member.
func (hc *HouseholdContext) HasScope(scope string) bool {
	return hc.IsService() && slices.Contains(hc.Scopes, scope)
}
