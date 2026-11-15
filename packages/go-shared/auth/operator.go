package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

const (
	// OperatorRoleKey is the Zitadel project role that marks an installation operator.
	OperatorRoleKey = "alfheim_operator"

	// zitadelRolesClaim is the claim Zitadel fills with the user's project roles
	// when role assertion is enabled; zitadelProjectClaimPrefix/-Suffix wrap the
	// project-scoped variant urn:zitadel:iam:org:project:<projectId>:roles.
	zitadelRolesClaim         = "urn:zitadel:iam:org:project:roles"
	zitadelProjectClaimPrefix = "urn:zitadel:iam:org:project:"
	zitadelProjectClaimSuffix = ":roles"
)

// hasOperatorRole reports whether the token's Zitadel role claims grant the
// operator role. Both claim forms are objects keyed by role key; any other
// shape is treated as "no role" so a malformed claim can never grant access.
func hasOperatorRole(claims jwt.MapClaims) bool {
	for name, value := range claims {
		isRolesClaim := name == zitadelRolesClaim ||
			(strings.HasPrefix(name, zitadelProjectClaimPrefix) && strings.HasSuffix(name, zitadelProjectClaimSuffix))
		if !isRolesClaim {
			continue
		}
		roles, ok := value.(map[string]interface{})
		if !ok {
			continue
		}
		if _, granted := roles[OperatorRoleKey]; granted {
			return true
		}
	}
	return false
}

// IsOperator reports whether the authenticated user holds the installation
// operator role. Installation-wide resources must be gated on this, never on a
// household role, because any user can create a household and own it.
func IsOperator(ctx context.Context) bool {
	claims, err := GetUserClaims(ctx)
	return err == nil && claims.IsOperator
}

// RequireOperator rejects requests of authenticated users that do not hold the
// operator role with 403 operator_required.
func RequireOperator(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsOperator(r.Context()) {
			WriteOperatorRequired(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// WriteOperatorRequired writes the 403 operator_required error response.
func WriteOperatorRequired(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = fmt.Fprint(w, `{"error":"operator_required","message":"this action requires the alfheim_operator role"}`)
}
