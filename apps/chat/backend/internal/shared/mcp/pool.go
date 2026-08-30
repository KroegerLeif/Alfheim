package mcp

import (
	"context"
	"sync"
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

// ClientPool lazily constructs and reuses one Client per MCP server endpoint, so the
// session established during the initialize handshake is kept alive across chat
// turns instead of being re-negotiated on every single request.
type ClientPool struct {
	mu      sync.Mutex
	clients map[string]*Client
}

// NewClientPool creates an empty ClientPool.
func NewClientPool() *ClientPool {
	return &ClientPool{clients: make(map[string]*Client)}
}

// Get returns the Client for endpointURL, constructing it on first use.
func (p *ClientPool) Get(endpointURL string) ToolCaller {
	p.mu.Lock()
	defer p.mu.Unlock()

	if client, ok := p.clients[endpointURL]; ok {
		return client
	}
	client := NewClient(endpointURL)
	p.clients[endpointURL] = client
	return client
}
