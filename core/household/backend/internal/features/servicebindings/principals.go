package servicebindings

import (
	"net/http"
	"slices"
	"strings"

	"alfheim/go-shared/auth"
	"alfheim/household/internal/shared/httpjson"
)

// Principals is the set of Zitadel subjects that are service principals
// (ALFHEIM_SERVICE_PRINCIPAL_IDS). Only these subjects can be bound to a
// household, and none of them may use the public household API.
type Principals struct {
	ids []string
}

// NewPrincipals builds the set from the configured subjects; blanks are dropped.
func NewPrincipals(ids []string) Principals {
	var out []string
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" && !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return Principals{ids: out}
}

// Contains reports whether subject is a configured service principal.
func (p Principals) Contains(subject string) bool {
	return subject != "" && slices.Contains(p.ids, subject)
}

// Guard wraps the OIDC middleware of the public API so that a service
// principal is rejected with 403 on every route: it is never a member and may
// not create or join households, read profiles, members or invites.
func (p Principals) Guard(authMw func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		deny := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := auth.GetUserClaims(r.Context())
			if err != nil {
				httpjson.WriteUnauthorized(w)
				return
			}
			if p.Contains(claims.Subject) {
				httpjson.WriteError(w, http.StatusForbidden, "forbidden", "service principals cannot use the household API")
				return
			}
			next.ServeHTTP(w, r)
		})
		return authMw(deny)
	}
}
