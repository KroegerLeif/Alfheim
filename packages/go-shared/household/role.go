package household

import (
	"log/slog"
	"net/http"
)

// RequireHouseholdRole returns a middleware that admits only callers whose
// household role is one of roles, for example write endpoints that need
// RoleOwner or RoleAdmin. It must run after RequireHousehold and reads the role
// that the membership API confirmed, never a JWT claim or a request header.
// Without a household context it answers 500 rather than failing open; a
// role outside roles gets 403 with CodeHouseholdRoleForbidden.
func RequireHouseholdRole(log *slog.Logger, roles ...Role) func(http.Handler) http.Handler {
	allowed := make(map[Role]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			hc, err := GetHousehold(r.Context())
			if err != nil {
				log.Error("household role check without household context; RequireHousehold must run first")
				writeHouseholdError(w, http.StatusInternalServerError, CodeHouseholdContextMissing, "household context is missing")
				return
			}
			if _, ok := allowed[hc.Role]; !ok {
				log.Warn("household role denied",
					slog.String("household_id", hc.HouseholdID.String()),
					slog.String("user_id", hc.Subject),
					slog.String("role", string(hc.Role)))
				writeHouseholdError(w, http.StatusForbidden, CodeHouseholdRoleForbidden, "your household role does not allow this action")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
