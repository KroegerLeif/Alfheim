package signup

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"alfheim/go-shared/auth"
)

// userinfoTimeout bounds one discovery or userinfo request.
const userinfoTimeout = 5 * time.Second

// Identity is the verified e-mail information of a caller.
type Identity struct {
	Email         string
	EmailVerified bool
}

// IdentitySource looks up the caller's e-mail address with their own token.
type IdentitySource interface {
	Identity(ctx context.Context, accessToken string) (Identity, error)
}

// Policy enforces the allowlist at household creation. The household service
// calls it only for callers who are not a member of any household yet.
type Policy struct {
	List     Allowlist
	Identity IdentitySource
	Log      *slog.Logger
}

// AllowHouseholdCreation returns nil when claims may create their first
// household, ErrNotAllowed when the allowlist does not admit them, and any
// other error when their e-mail could not be checked (which also denies).
// The address comes from the issuer's userinfo endpoint, never from the
// access token, and only a verified address counts.
func (p Policy) AllowHouseholdCreation(ctx context.Context, claims *auth.UserClaims) error {
	if !p.List.Enabled() {
		return nil
	}
	if claims == nil || claims.AccessToken == "" || p.Identity == nil {
		return ErrNotAllowed
	}
	id, err := p.Identity.Identity(ctx, claims.AccessToken)
	if err != nil {
		return fmt.Errorf("signup: look up the caller's e-mail: %w", err)
	}
	if !id.EmailVerified || !p.List.Allows(id.Email) {
		if p.Log != nil {
			p.Log.InfoContext(ctx, "household creation refused by the sign-up allowlist",
				slog.String("user_id", claims.Subject), slog.Bool("email_verified", id.EmailVerified))
		}
		return ErrNotAllowed
	}
	return nil
}

// UserInfoSource reads the caller's e-mail from the OIDC userinfo endpoint
// named in the issuer's discovery document.
type UserInfoSource struct {
	IssuerURL string
	HTTP      *http.Client

	mu       sync.Mutex
	endpoint string
}

// Identity implements IdentitySource.
func (s *UserInfoSource) Identity(ctx context.Context, accessToken string) (Identity, error) {
	endpoint, err := s.userinfoEndpoint(ctx)
	if err != nil {
		return Identity{}, err
	}
	var info struct {
		Email         string `json:"email"`
		EmailVerified any    `json:"email_verified"`
	}
	if err := s.getJSON(ctx, endpoint, accessToken, &info); err != nil {
		return Identity{}, err
	}
	return Identity{Email: info.Email, EmailVerified: isTrue(info.EmailVerified)}, nil
}

// userinfoEndpoint discovers the endpoint once and caches it.
func (s *UserInfoSource) userinfoEndpoint(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.endpoint != "" {
		return s.endpoint, nil
	}
	var doc struct {
		UserinfoEndpoint string `json:"userinfo_endpoint"`
	}
	discovery := strings.TrimRight(s.IssuerURL, "/") + "/.well-known/openid-configuration"
	if err := s.getJSON(ctx, discovery, "", &doc); err != nil {
		return "", err
	}
	if doc.UserinfoEndpoint == "" {
		return "", errors.New("signup: the OIDC discovery document names no userinfo_endpoint")
	}
	s.endpoint = doc.UserinfoEndpoint
	return s.endpoint, nil
}

func (s *UserInfoSource) getJSON(ctx context.Context, url, bearer string, out any) error {
	ctx, cancel := context.WithTimeout(ctx, userinfoTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("signup: build request for %s: %w", url, err)
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	client := s.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("signup: GET %s: %w", url, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("signup: GET %s returned HTTP %d", url, resp.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out); err != nil {
		return fmt.Errorf("signup: decode %s: %w", url, err)
	}
	return nil
}

// isTrue accepts the boolean form of email_verified and the "true" string
// some providers send.
func isTrue(v any) bool {
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return strings.EqualFold(b, "true")
	default:
		return false
	}
}
