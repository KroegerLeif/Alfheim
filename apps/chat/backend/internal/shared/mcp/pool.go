package mcp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// ToolCaller is the subset of *Client's behavior the tool-calling bridge needs.
// Defined as an interface (rather than consumers depending on *Client directly) so
// ClientPool.Get's result can be faked in tests without a real MCP server.
type ToolCaller interface {
	ListTools(ctx context.Context) ([]Tool, error)
	CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error)
	Ping(ctx context.Context) DiagnosticResult
}

// ServerRef identifies a single registered MCP server for the bridge to talk to.
// Defined here (shared/infra) rather than in the mcpservers feature package so
// consumers like internal/features/conversations can depend on it without importing
// internal/features/mcpservers.
type ServerRef struct {
	// ID is the mcp_server_registry row id, used to correlate a tool result back to
	// its originating server for audit purposes (messages.mcp_server_id).
	ID string
	// Slug is the Fach-App identifier, e.g. "pantry".
	Slug string
	// EndpointURL is the internal Streamable HTTP endpoint, e.g. http://pantry-backend:8000/mcp.
	EndpointURL string
}

const (
	// clientIdleTTL is how long a per-caller Client may stay unused before the pool
	// drops it (and with it the MCP session and the cached tool list).
	clientIdleTTL = 15 * time.Minute
	// sweepInterval bounds how often Get scans the pool for idle clients.
	sweepInterval = time.Minute
)

// clientScope identifies whose MCP session a Client holds. MCP servers may attach
// state to an Mcp-Session-Id (the Python SDK runs a stateful session's tools in a
// task whose context was copied from the session's first request), so a session
// negotiated for one user/household must never be reused for another.
type clientScope struct {
	endpointURL string
	householdID string
	principal   string
}

type pooledClient struct {
	client   *Client
	lastUsed time.Time
}

// ClientPool hands out MCP clients that keep one Client, and therefore one MCP
// session, per (endpoint, household, user). Reusing a session within that scope
// avoids re-negotiating the initialize handshake on every chat turn; keeping scopes
// apart guarantees that a session and its cached tool list never cross user or
// household boundaries. Idle clients are dropped after clientIdleTTL.
type ClientPool struct {
	mu        sync.Mutex
	clients   map[clientScope]*pooledClient
	lastSweep time.Time
	now       func() time.Time
}

// NewClientPool creates an empty ClientPool.
func NewClientPool() *ClientPool {
	return &ClientPool{clients: make(map[clientScope]*pooledClient), now: time.Now}
}

// Get returns a ToolCaller for endpointURL. The concrete Client is resolved on every
// call from the CallerCredentials carried by that call's context, so the session id
// sent to the server always belongs to the same user and household as the bearer
// token and X-Household-ID sent with it.
func (p *ClientPool) Get(endpointURL string) ToolCaller {
	return &scopedCaller{pool: p, endpointURL: endpointURL}
}

// clientFor returns the Client for endpointURL in the caller scope of ctx,
// constructing it on first use.
func (p *ClientPool) clientFor(ctx context.Context, endpointURL string) *Client {
	scope := scopeFor(ctx, endpointURL)

	p.mu.Lock()
	defer p.mu.Unlock()

	now := p.now()
	p.sweepIdleLocked(now)

	entry, ok := p.clients[scope]
	if !ok {
		entry = &pooledClient{client: NewClient(endpointURL)}
		p.clients[scope] = entry
	}
	entry.lastUsed = now
	return entry.client
}

// sweepIdleLocked drops clients unused for clientIdleTTL. Callers hold p.mu.
func (p *ClientPool) sweepIdleLocked(now time.Time) {
	if now.Sub(p.lastSweep) < sweepInterval {
		return
	}
	p.lastSweep = now
	for scope, entry := range p.clients {
		if now.Sub(entry.lastUsed) >= clientIdleTTL {
			delete(p.clients, scope)
		}
	}
}

// size reports the number of pooled clients (for tests).
func (p *ClientPool) size() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.clients)
}

// scopeFor derives the pool key for a call. Calls without caller credentials (the
// startup diagnostic) share one anonymous scope per endpoint. A caller with a token
// but no user id is keyed by a hash of the token, so two distinct tokens can never
// share a session.
func scopeFor(ctx context.Context, endpointURL string) clientScope {
	scope := clientScope{endpointURL: endpointURL}
	creds, ok := CallerCredentialsFrom(ctx)
	if !ok {
		return scope
	}
	scope.householdID = creds.HouseholdID
	switch {
	case creds.UserID != "":
		scope.principal = "user:" + creds.UserID
	case creds.AccessToken != "":
		sum := sha256.Sum256([]byte(creds.AccessToken))
		scope.principal = "token:" + hex.EncodeToString(sum[:])
	}
	return scope
}

// scopedCaller is the ToolCaller returned by ClientPool.Get. It is cheap and holds
// no session state of its own.
type scopedCaller struct {
	pool        *ClientPool
	endpointURL string
}

func (s *scopedCaller) ListTools(ctx context.Context) ([]Tool, error) {
	return s.pool.clientFor(ctx, s.endpointURL).ListTools(ctx)
}

func (s *scopedCaller) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	return s.pool.clientFor(ctx, s.endpointURL).CallTool(ctx, toolName, arguments)
}

func (s *scopedCaller) Ping(ctx context.Context) DiagnosticResult {
	return s.pool.clientFor(ctx, s.endpointURL).Ping(ctx)
}
