// Package auth validates the OIDC access tokens of every Alfheim Go backend.
//
// Zitadel only authenticates (ADR 0003): a token proves who the caller is,
// never which household they act in or what role they hold there. Household
// membership is confirmed per request against the core/household membership
// API (or, inside core/household, against its own database).
package auth

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

	"alfheim/go-shared/httpmw"
)

type contextKey string

const (
	// UserContextKey is the context key for stored UserClaims.
	UserContextKey contextKey = "user_claims"

	// discoveryPath is the standard OIDC discovery document suffix.
	discoveryPath = "/.well-known/openid-configuration"

	// discoveryTimeout bounds the startup discovery request.
	discoveryTimeout = 10 * time.Second
)

// acceptedSigningMethods lists the only JWS algorithms a token may use. Zitadel
// signs access tokens with RS256; anything else (HS256, none, ES256, ...) is rejected.
var acceptedSigningMethods = []string{"RS256"}

// Config configures NewAuthenticator.
type Config struct {
	// IssuerURL is the canonical OIDC issuer. Tokens must carry exactly this
	// `iss` (a trailing slash is trimmed) and the JWKS is discovered from
	// {IssuerURL}/.well-known/openid-configuration. Required.
	IssuerURL string
	// Audience is the value the token `aud` claim must contain. Required.
	Audience string
	// HTTPClient performs discovery and JWKS downloads. Nil uses a client with a
	// 10 s timeout that trusts the system roots plus ALFHEIM_EXTRA_CA_FILE.
	HTTPClient *http.Client
	// Logger receives validation and key refresh failures. Nil uses slog.Default().
	Logger *slog.Logger
}

// Authenticator validates OIDC bearer tokens against the issuer's signing keys.
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

// NewAuthenticator discovers the JWKS URI from the issuer's OIDC discovery
// document and caches the downloaded signing keys.
//
// It fails closed: a missing issuer or audience, any error reaching the issuer,
// parsing the discovery document or downloading the JWKS results in a non-nil
// error and a nil Authenticator.
func NewAuthenticator(ctx context.Context, cfg Config) (*Authenticator, error) {
	issuerURL := strings.TrimRight(strings.TrimSpace(cfg.IssuerURL), "/")
	if issuerURL == "" {
		return nil, errors.New("oidc issuer url is required")
	}
	audience := strings.TrimSpace(cfg.Audience)
	if audience == "" {
		return nil, errors.New("oidc audience is required")
	}
	log := cfg.Logger
	if log == nil {
		log = slog.Default()
	}

	client := cfg.HTTPClient
	if client == nil {
		// Nil transport unless ALFHEIM_EXTRA_CA_FILE is set; then discovery and JWKS
		// refreshes trust the installer's private root CA in addition to the system roots.
		transport, err := httpmw.ExtraCATransport()
		if err != nil {
			return nil, fmt.Errorf("failed to configure oidc tls trust: %w", err)
		}
		client = &http.Client{Timeout: discoveryTimeout, Transport: transport}
	}

	jwksURI, err := discoverJWKSURI(ctx, client, issuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to discover oidc configuration for issuer %s: %w", issuerURL, err)
	}

	// keyfunc runs its refresh loop on its own context (stopped by Close), not on
	// ctx: callers pass a startup deadline that must not end key rotation.
	jwks, err := keyfunc.Get(jwksURI, keyfunc.Options{
		Client:            client,
		RefreshInterval:   time.Hour,
		RefreshTimeout:    10 * time.Second,
		RefreshUnknownKID: true,
		RefreshRateLimit:  5 * time.Second,
		RefreshErrorHandler: func(err error) {
			log.Error("failed to refresh oidc JWKS keys", slog.String("error", err.Error()))
		},
	})
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

// Close stops the background JWKS refresh. It is safe on a nil Authenticator.
func (a *Authenticator) Close() {
	if a == nil || a.jwks == nil {
		return
	}
	a.jwks.EndBackground()
}

// discoverJWKSURI fetches {issuerURL}/.well-known/openid-configuration and returns its jwks_uri.
func discoverJWKSURI(ctx context.Context, client *http.Client, issuerURL string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, discoveryTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, issuerURL+discoveryPath, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
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

// AuthenticateMiddleware enforces a valid OIDC bearer token and stores the
// caller's UserClaims in the request context. The token must be RS256-signed
// by a key from the issuer's JWKS, carry the configured issuer and audience, an
// expiry in the future and a non-empty subject. The request host plays no part.
func (a *Authenticator) AuthenticateMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteUnauthorized(w, "missing authorization header")
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			WriteUnauthorized(w, "invalid authorization header format")
			return
		}
		rawToken := parts[1]

		token, err := jwt.Parse(rawToken, a.jwks.Keyfunc,
			jwt.WithExpirationRequired(),
			jwt.WithValidMethods(acceptedSigningMethods),
			jwt.WithIssuer(a.expectedIssuer),
			jwt.WithAudience(a.expectedAudience),
		)
		if err != nil || !token.Valid {
			a.log.Warn("invalid jwt bearer token received", slog.String("error", fmt.Sprintf("%v", err)))
			WriteUnauthorized(w, "invalid or expired token")
			return
		}

		claimsMap, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			WriteUnauthorized(w, "invalid token claims payload")
			return
		}

		userClaims := extractUserClaims(claimsMap)
		if userClaims.Subject == "" {
			WriteUnauthorized(w, "token has no subject")
			return
		}
		userClaims.AccessToken = rawToken

		ctx := context.WithValue(r.Context(), UserContextKey, userClaims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// WriteUnauthorized writes the 401 unauthorized error response.
func WriteUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = fmt.Fprintf(w, `{"error":"unauthorized","message":%q}`, message)
}
