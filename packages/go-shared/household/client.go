// Package householdclient checks household membership against the internal API of
// core/household, which owns households, memberships and roles. Zitadel only
// authenticates users; it never issues household claims.
package householdclient

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

	"github.com/google/uuid"
)

// Role is a household membership role as reported by core/household.
type Role string

// Roles defined by the Sprint 2 membership contract.
const (
	RoleOwner  Role = "OWNER"
	RoleAdmin  Role = "ADMIN"
	RoleMember Role = "MEMBER"
	RoleGuest  Role = "GUEST"
)

// Valid reports whether r is one of the roles defined by the membership contract.
func (r Role) Valid() bool {
	switch r {
	case RoleOwner, RoleAdmin, RoleMember, RoleGuest:
		return true
	}
	return false
}

const (
	// DefaultBaseURL is used when HOUSEHOLD_INTERNAL_URL is unset.
	DefaultBaseURL = "http://household-backend:8080"

	// PositiveTTL bounds how long a confirmed membership is reused.
	PositiveTTL = 30 * time.Second
	// NegativeTTL bounds how long a "not a member" answer is reused.
	NegativeTTL = 5 * time.Second

	defaultTimeout  = 3 * time.Second
	maxCacheEntries = 10000
)

var (
	// ErrNotMember means the household service answered that the user is not a
	// member of the household (404, or 400 for a malformed lookup).
	ErrNotMember = errors.New("user is not a member of the household")
	// ErrUnavailable means membership could not be determined (network error,
	// timeout, 5xx, rejected service token or malformed response). Callers must
	// fail closed.
	ErrUnavailable = errors.New("household membership service unavailable")
)

// Membership is a confirmed membership of a user in a household.
type Membership struct {
	HouseholdID uuid.UUID
	UserID      string
	Role        Role
}

// Checker resolves a user's membership in a household.
type Checker interface {
	CheckMembership(ctx context.Context, householdID uuid.UUID, userSub string) (Membership, error)
}

type cacheEntry struct {
	membership Membership
	member     bool
	expires    time.Time
}

// Client calls GET {baseURL}/internal/v1/memberships/{householdId}/{userSub} and
// caches answers (positive PositiveTTL, negative NegativeTTL). Errors are never
// cached. It is safe for concurrent use.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
	now        func() time.Time

	mu    sync.Mutex
	cache map[string]cacheEntry
}

// Option customizes a Client.
type Option func(*Client)

// WithHTTPClient replaces the default HTTP client (3 s timeout).
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.httpClient = hc }
}

// WithClock replaces time.Now, for tests.
func WithClock(now func() time.Time) Option {
	return func(c *Client) { c.now = now }
}

// New creates a Client. token is the shared ALFHEIM_INTERNAL_TOKEN.
func New(baseURL, token string, opts ...Option) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	c := &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		token:      token,
		httpClient: &http.Client{Timeout: defaultTimeout},
		now:        time.Now,
		cache:      make(map[string]cacheEntry),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

type membershipResponse struct {
	HouseholdID string `json:"household_id"`
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
}

// CheckMembership returns the caller's membership, ErrNotMember, or ErrUnavailable.
func (c *Client) CheckMembership(ctx context.Context, householdID uuid.UUID, userSub string) (Membership, error) {
	if userSub == "" {
		return Membership{}, ErrNotMember
	}
	key := householdID.String() + "|" + userSub

	if m, member, ok := c.lookup(key); ok {
		if !member {
			return Membership{}, ErrNotMember
		}
		return m, nil
	}

	m, err := c.fetch(ctx, householdID, userSub)
	switch {
	case err == nil:
		c.store(key, cacheEntry{membership: m, member: true, expires: c.now().Add(PositiveTTL)})
		return m, nil
	case errors.Is(err, ErrNotMember):
		c.store(key, cacheEntry{member: false, expires: c.now().Add(NegativeTTL)})
		return Membership{}, err
	default:
		return Membership{}, err
	}
}

func (c *Client) fetch(ctx context.Context, householdID uuid.UUID, userSub string) (Membership, error) {
	endpoint := fmt.Sprintf("%s/internal/v1/memberships/%s/%s",
		c.baseURL, url.PathEscape(householdID.String()), url.PathEscape(userSub))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Membership{}, fmt.Errorf("%w: build request: %v", ErrUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Membership{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound, http.StatusBadRequest:
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return Membership{}, ErrNotMember
	default:
		// 401 means our service token was rejected (misconfiguration); like 5xx it
		// tells us nothing about the user, so fail closed as unavailable.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return Membership{}, fmt.Errorf("%w: unexpected status %d", ErrUnavailable, resp.StatusCode)
	}

	var body membershipResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&body); err != nil {
		return Membership{}, fmt.Errorf("%w: decode response: %v", ErrUnavailable, err)
	}

	gotHH, err := uuid.Parse(body.HouseholdID)
	if err != nil || gotHH != householdID || body.UserID != userSub {
		return Membership{}, fmt.Errorf("%w: response does not match the requested membership", ErrUnavailable)
	}
	role := Role(strings.ToUpper(strings.TrimSpace(body.Role)))
	if !role.Valid() {
		return Membership{}, fmt.Errorf("%w: unknown role %q", ErrUnavailable, body.Role)
	}

	return Membership{HouseholdID: householdID, UserID: userSub, Role: role}, nil
}

func (c *Client) lookup(key string) (Membership, bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.cache[key]
	if !ok {
		return Membership{}, false, false
	}
	if !c.now().Before(e.expires) {
		delete(c.cache, key)
		return Membership{}, false, false
	}
	return e.membership, e.member, true
}

func (c *Client) store(key string, e cacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.cache) >= maxCacheEntries {
		now := c.now()
		for k, v := range c.cache {
			if !now.Before(v.expires) {
				delete(c.cache, k)
			}
		}
		if len(c.cache) >= maxCacheEntries {
			// Still full of live entries: drop everything rather than grow unbounded.
			c.cache = make(map[string]cacheEntry)
		}
	}
	c.cache[key] = e
}
