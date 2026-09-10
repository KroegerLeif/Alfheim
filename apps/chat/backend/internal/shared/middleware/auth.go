// Package middleware provides HTTP middlewares including JWT validation and request tracing.
package middleware

import (
	"context"
	"encoding/json"
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

	// defaultIssuer is used when no issuer is supplied to NewAuthenticator.
	defaultIssuer = "http://localhost:8080"

	// discoveryPath is the standard OIDC discovery document suffix.
	discoveryPath = "/.well-known/openid-configuration"
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
}

// Authenticator handles generic OIDC JWT validation using a discovered JWKS endpoint.
type Authenticator struct {
	jwks             *keyfunc.JWKS
	expectedIssuer   string
	expectedAudience string
	log              *slog.Logger
}

// oidcDiscoveryDocument models the subset of the OIDC discovery document we consume.
type oidcDiscoveryDocument struct {
	Issuer  string `json:"issuer"`
	JWKSURI string `json:"jwks_uri"`
}

// NewAuthenticator creates an Authenticator by discovering the JWKS URI from the
// issuer's OIDC discovery document and caching the downloaded signing keys.
//
// It fails closed: any error reaching the issuer, parsing the discovery document
// or downloading the JWKS results in a non-nil error and a nil Authenticator.
func NewAuthenticator(issuerURL string, audience string, log *slog.Logger) (*Authenticator, error) {
	if issuerURL == "" {
		issuerURL = defaultIssuer
	}
	issuerURL = strings.TrimRight(issuerURL, "/")

	jwksURI, err := discoverJWKSURI(issuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to discover oidc configuration for issuer %s: %w", issuerURL, err)
	}

	options := keyfunc.Options{
		RefreshInterval: time.Hour,
		RefreshTimeout:  time.Second * 10,
		RefreshErrorHandler: func(err error) {
			log.Error("failed to refresh oidc JWKS keys", slog.String("error", err.Error()))
		},
	}

	jwks, err := keyfunc.Get(jwksURI, options)
	if err != nil {
		return nil, fmt.Errorf("failed to create keyfunc JWKS from url %s: %w", jwksURI, err)
	}

	return &Authenticator{
		jwks:             jwks,
		expectedIssuer:   issuerURL,
		expectedAudience: audience,
		log:              log,
	}, nil
}

// discoverJWKSURI fetches {issuerURL}/.well-known/openid-configuration and returns
// its jwks_uri value.
func discoverJWKSURI(issuerURL string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(issuerURL + discoveryPath)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d fetching oidc discovery document", resp.StatusCode)
	}

	var doc oidcDiscoveryDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return "", fmt.Errorf("failed to decode oidc discovery document: %w", err)
	}

	if doc.JWKSURI == "" {
		return "", errors.New("oidc discovery document does not contain a jwks_uri")
	}

	return doc.JWKSURI, nil
}

// AuthenticateMiddleware enforces valid OIDC JWT Bearer tokens in incoming HTTP requests.
func (a *Authenticator) AuthenticateMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeUnauthorized(w, "missing authorization header")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeUnauthorized(w, "invalid authorization header format")
			return
		}

		rawToken := parts[1]

		parseOpts := []jwt.ParserOption{jwt.WithExpirationRequired()}
		if a.expectedIssuer != "" {
			parseOpts = append(parseOpts, jwt.WithIssuer(a.expectedIssuer))
		}
		if a.expectedAudience != "" {
			parseOpts = append(parseOpts, jwt.WithAudience(a.expectedAudience))
		}

		token, err := jwt.Parse(rawToken, a.jwks.Keyfunc, parseOpts...)
		if err != nil || !token.Valid {
			a.log.Warn("invalid jwt bearer token received", slog.String("error", fmt.Sprintf("%v", err)))
			writeUnauthorized(w, "invalid or expired token")
			return
		}

		claimsMap, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			writeUnauthorized(w, "invalid token claims payload")
			return
		}

		userClaims := extractUserClaims(claimsMap, r)
		ctx := context.WithValue(r.Context(), UserContextKey, userClaims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = fmt.Fprintf(w, `{"error":"unauthorized","message":%q}`, message)
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
			for _, role := range rolesInterface {
				if roleStr, ok := role.(string); ok {
					uc.Roles = append(uc.Roles, roleStr)
				}
			}
		}
	}

	return uc
}
