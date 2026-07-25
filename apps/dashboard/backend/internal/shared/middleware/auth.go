// Package middleware provides HTTP middlewares including JWT validation and request tracing.
package middleware

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	// UserContextKey is the context key for stored UserClaims.
	UserContextKey contextKey = "user_claims"
)

// UserClaims defines authenticated user claims extracted from OIDC JWT tokens.
type UserClaims struct {
	Subject           string   `json:"sub"`
	Email             string   `json:"email"`
	PreferredUsername string   `json:"preferred_username"`
	GivenName         string   `json:"given_name"`
	FamilyName        string   `json:"family_name"`
	Roles             []string `json:"roles"`
}

// Authenticator handles OIDC JWT validation via Keycloak JWKS endpoint.
type Authenticator struct {
	jwks *keyfunc.JWKS
	log  *slog.Logger
}

// NewAuthenticator creates an Authenticator instance that fetches and caches JWKS.
func NewAuthenticator(jwksURL string, log *slog.Logger) (*Authenticator, error) {
	options := keyfunc.Options{
		RefreshInterval: time.Hour,
		RefreshTimeout:  time.Second * 10,
		RefreshErrorHandler: func(err error) {
			log.Error("failed to refresh keycloak JWKS keys", slog.String("error", err.Error()))
		},
	}

	jwks, err := keyfunc.Get(jwksURL, options)
	if err != nil {
		return nil, fmt.Errorf("failed to create keyfunc JWKS from url %s: %w", jwksURL, err)
	}

	return &Authenticator{
		jwks: jwks,
		log:  log,
	}, nil
}

// AuthenticateMiddleware enforces valid OIDC JWT Bearer tokens in incoming HTTP requests.
func (a *Authenticator) AuthenticateMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"unauthorized","message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			http.Error(w, `{"error":"unauthorized","message":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		rawToken := parts[1]

		token, err := jwt.Parse(rawToken, a.jwks.Keyfunc)
		if err != nil || !token.Valid {
			a.log.Warn("invalid jwt bearer token received", slog.String("error", err.Error()))
			http.Error(w, `{"error":"unauthorized","message":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		claimsMap, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"unauthorized","message":"invalid token claims payload"}`, http.StatusUnauthorized)
			return
		}

		userClaims := extractUserClaims(claimsMap)
		ctx := context.WithValue(r.Context(), UserContextKey, userClaims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserClaims retrieves UserClaims from the HTTP request context.
func GetUserClaims(ctx context.Context) (*UserClaims, error) {
	claims, ok := ctx.Value(UserContextKey).(*UserClaims)
	if !ok || claims == nil {
		return nil, errors.New("user claims not found in context")
	}
	return claims, nil
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
			for _, r := range rolesInterface {
				if roleStr, ok := r.(string); ok {
					uc.Roles = append(uc.Roles, roleStr)
				}
			}
		}
	}

	return uc
}
