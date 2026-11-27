package actions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// tokenRefreshMargin renews a cached token this long before it expires.
const tokenRefreshMargin = 30 * time.Second

// ErrTokenUnavailable means no service principal token could be obtained.
var ErrTokenUnavailable = errors.New("service principal token unavailable")

// PrincipalConfig holds the client credentials of the alfheim-integrations
// machine user (#958).
type PrincipalConfig struct {
	// IssuerURL is OIDC_ISSUER_URL; the token endpoint comes from its
	// discovery document.
	IssuerURL    string
	ClientID     string
	ClientSecret string
	// ProjectID is ZITADEL_PROJECT_ID, so the token's audience is the project.
	ProjectID string
}

// TokenSource requests short-lived client-credentials tokens for the service
// principal and caches each until shortly before it expires. It is safe for
// concurrent use. The secret and tokens are never logged.
type TokenSource struct {
	cfg    PrincipalConfig
	client *http.Client
	now    func() time.Time

	mu       sync.Mutex
	tokenURL string
	token    string
	expires  time.Time
}

// NewTokenSource returns a token source using client for the issuer.
func NewTokenSource(cfg PrincipalConfig, client *http.Client) *TokenSource {
	return &TokenSource{cfg: cfg, client: client, now: time.Now}
}

// Token returns a valid access token, requesting a new one when needed.
func (s *TokenSource) Token(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token != "" && s.now().Add(tokenRefreshMargin).Before(s.expires) {
		return s.token, nil
	}
	if s.tokenURL == "" {
		tokenURL, err := s.discover(ctx)
		if err != nil {
			return "", err
		}
		s.tokenURL = tokenURL
	}
	var body struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	form := url.Values{
		"grant_type": {"client_credentials"},
		"scope":      {"openid urn:zitadel:iam:org:project:id:" + s.cfg.ProjectID + ":aud"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("%w: build token request: %w", ErrTokenUnavailable, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(url.QueryEscape(s.cfg.ClientID), url.QueryEscape(s.cfg.ClientSecret))
	if err := s.do(req, &body); err != nil {
		return "", err
	}
	if body.AccessToken == "" || body.ExpiresIn <= 0 {
		return "", fmt.Errorf("%w: the token answer has no token", ErrTokenUnavailable)
	}
	s.token = body.AccessToken
	s.expires = s.now().Add(time.Duration(body.ExpiresIn) * time.Second)
	return s.token, nil
}

// discover reads token_endpoint from the issuer's discovery document.
func (s *TokenSource) discover(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		strings.TrimRight(s.cfg.IssuerURL, "/")+"/.well-known/openid-configuration", nil)
	if err != nil {
		return "", fmt.Errorf("%w: build discovery request: %w", ErrTokenUnavailable, err)
	}
	var doc struct {
		TokenEndpoint string `json:"token_endpoint"`
	}
	if err := s.do(req, &doc); err != nil {
		return "", err
	}
	if doc.TokenEndpoint == "" {
		return "", fmt.Errorf("%w: the discovery document names no token endpoint", ErrTokenUnavailable)
	}
	return doc.TokenEndpoint, nil
}

// do sends req and decodes a 200 JSON answer; other answers are errors
// without their body, which could echo the request.
func (s *TokenSource) do(req *http.Request, out any) error {
	req.Header.Set("Accept", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrTokenUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: status %d", ErrTokenUnavailable, resp.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(out); err != nil {
		return fmt.Errorf("%w: decode answer: %w", ErrTokenUnavailable, err)
	}
	return nil
}
