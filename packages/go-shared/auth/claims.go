package auth

import (
	"context"
	"errors"

	"github.com/golang-jwt/jwt/v5"
)

// UserClaims holds the identity of the authenticated caller, extracted from
// the OIDC access token.
//
// It deliberately carries no household information: Zitadel only
// authenticates (ADR 0003). Household membership and role come from the
// core/household membership API, never from the token.
type UserClaims struct {
	Subject           string `json:"sub"`
	Email             string `json:"email"`
	PreferredUsername string `json:"preferred_username"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`

	// Roles holds the installation-wide realm_access roles, if the issuer sets
	// them. They are never household roles.
	Roles []string `json:"roles,omitempty"`

	// IsOperator is true when the token carries the Zitadel project role
	// alfheim_operator (requires access token role assertion on the OIDC app).
	IsOperator bool `json:"-"`

	// AccessToken is the request's raw bearer token, kept only so it can be
	// forwarded to other Alfheim APIs on the user's behalf. It is never
	// serialized or logged.
	AccessToken string `json:"-"`
}

// GetUserClaims retrieves UserClaims from the request context.
func GetUserClaims(ctx context.Context) (*UserClaims, error) {
	claims, ok := ctx.Value(UserContextKey).(*UserClaims)
	if !ok || claims == nil {
		return nil, errors.New("user claims not found in context")
	}
	return claims, nil
}

// ContextWithUserClaims returns ctx carrying claims, as AuthenticateMiddleware
// does. Exposed for handler tests that bypass the real middleware.
func ContextWithUserClaims(ctx context.Context, claims *UserClaims) context.Context {
	return context.WithValue(ctx, UserContextKey, claims)
}

func extractUserClaims(claims jwt.MapClaims) *UserClaims {
	uc := &UserClaims{}

	if sub, ok := claims["sub"].(string); ok {
		uc.Subject = sub
	}
	if email, ok := claims["email"].(string); ok {
		uc.Email = email
	}
	if username, ok := claims["preferred_username"].(string); ok {
		uc.PreferredUsername = username
	}
	if givenName, ok := claims["given_name"].(string); ok {
		uc.GivenName = givenName
	}
	if familyName, ok := claims["family_name"].(string); ok {
		uc.FamilyName = familyName
	}

	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if rolesInterface, ok := realmAccess["roles"].([]interface{}); ok {
			for _, roleValue := range rolesInterface {
				if roleStr, ok := roleValue.(string); ok {
					uc.Roles = append(uc.Roles, roleStr)
				}
			}
		}
	}

	uc.IsOperator = hasOperatorRole(claims)
	return uc
}
