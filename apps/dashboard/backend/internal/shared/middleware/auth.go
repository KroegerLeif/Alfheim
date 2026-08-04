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
	"github.com/jackc/pgx/v5/pgxpool"
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
	HouseholdID       string   `json:"household_id"`
	HouseholdRole     string   `json:"household_role"`
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized","message":"missing authorization header"}`))
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized","message":"invalid authorization header format"}`))
			return
		}

		rawToken := parts[1]

		token, err := jwt.Parse(rawToken, a.jwks.Keyfunc)
		if err != nil || !token.Valid {
			a.log.Warn("invalid jwt bearer token received", slog.String("error", err.Error()))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized","message":"invalid or expired token"}`))
			return
		}

		claimsMap, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized","message":"invalid token claims payload"}`))
			return
		}

		userClaims := extractUserClaims(claimsMap, r)
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

func extractUserClaims(claims jwt.MapClaims, r *http.Request) *UserClaims {
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

	if householdID, ok := claims["household_id"].(string); ok && householdID != "" {
		uc.HouseholdID = householdID
	} else if activeHouseholdID, ok := claims["active_household_id"].(string); ok && activeHouseholdID != "" {
		uc.HouseholdID = activeHouseholdID
	} else if headerHousehold := r.Header.Get("X-Household-ID"); headerHousehold != "" {
		uc.HouseholdID = headerHousehold
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

// HouseholdRoleMiddleware queries the database to find the user's role for the active household
// and injects it into both the request context claims and request headers.
func HouseholdRoleMiddleware(db *pgxpool.Pool, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := GetUserClaims(r.Context())
			if err != nil {
				// No claims present, likely unauthenticated route
				next.ServeHTTP(w, r)
				return
			}

			householdID := claims.HouseholdID
			if householdID == "" {
				householdID = r.Header.Get("X-Household-ID")
			}

			if householdID != "" && claims.Subject != "" {
				var role string
				query := `SELECT role FROM household_members WHERE household_id = $1 AND user_id = $2`
				err := db.QueryRow(r.Context(), query, householdID, claims.Subject).Scan(&role)
				if err == nil {
					// Add household role to claims
					claims.HouseholdRole = role
					// Propagate role header for downstream microservices
					r.Header.Set("X-Household-Role", role)
				} else {
					log.Debug("household role lookup failed", slog.String("household_id", householdID), slog.String("user_id", claims.Subject), slog.String("error", err.Error()))
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
