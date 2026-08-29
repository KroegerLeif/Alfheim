// Package llm defines the provider-agnostic abstraction used to talk to LLM backends
// (local Ollama today, OpenAI-compatible and other external APIs in later phases).
package llm

import "context"

// Role identifies who authored a chat message.
type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleSystem    Role = "system"
	RoleTool      Role = "tool"
)

// Message is a single turn in a chat conversation.
type Message struct {
	Role Role
	// Content holds the plain text of the message.
	Content string
	// ToolCallID correlates a tool-result message (Role == RoleTool) back to the
	// tool call that produced it. Empty for all other roles.
	ToolCallID string
	// ToolCalls holds the tool invocations an assistant message requested. Only
	// meaningful when Role == RoleAssistant; required so a subsequent round of the
	// tool-calling loop can replay the assistant's own tool-call turn back to the
	// provider (each ChatStream call is otherwise stateless from the provider's side).
	ToolCalls []ToolCallRequest
}

// ToolDefinition describes an MCP tool made available to the model for this request,
// translated into the provider's native tool-calling schema by the caller.
type ToolDefinition struct {
	Name        string
	Description string
	// Parameters is the tool's input JSON schema, as returned by MCP's list_tools.
	Parameters map[string]any
}

// ToolCallRequest is a tool invocation requested by the model mid-response.
type ToolCallRequest struct {
	ID        string
	ToolName  string
	Arguments map[string]any
}

// Usage reports token accounting for a completed exchange, when the provider supplies it.
type Usage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// ChatRequest is a single request to a Provider.
type ChatRequest struct {
	Messages []Message
	Tools    []ToolDefinition
	// Stream requests incremental StreamChunk delivery. Providers that only support
	// non-streaming responses may emit the full response as a single final chunk.
	Stream bool
}

// StreamChunk is one increment of a streamed chat response.
//
// A chunk carries at most one of DeltaText or ToolCall. Done is true on the final
// chunk of the stream (whether it ends in text, a tool call, or an error); Err is set
// only on a terminal error, after which no further chunks are sent and the channel is closed.
type StreamChunk struct {
	DeltaText string
	ToolCall  *ToolCallRequest
	Done      bool
	Usage     *Usage
	Err       error
}

// HealthStatus classifies the outcome of a Provider health check.
type HealthStatus string

const (
	// HealthStatusOK means the provider responded successfully.
	HealthStatusOK HealthStatus = "ok"
	// HealthStatusUnreachable means the provider could not be reached at all
	// (connection refused, DNS failure, timeout).
	HealthStatusUnreachable HealthStatus = "unreachable"
	// HealthStatusAuthInvalid means the provider was reachable but rejected the
	// configured credentials (HTTP 401/403).
	HealthStatusAuthInvalid HealthStatus = "auth_invalid"
	// HealthStatusUnknown covers any other unexpected response.
	HealthStatusUnknown HealthStatus = "unknown"
)

// HealthResult is the outcome of a Provider.HealthCheck call.
type HealthResult struct {
	Status HealthStatus
	// Detail is a human-readable, non-sensitive description suitable for display in the UI.
	Detail string
}

// ProviderPolicy carries per-model-block tool-calling limits alongside a resolved
// Provider. It lives here (rather than on the modelblocks or conversations domain
// types) so both features can share it without depending on one another.
type ProviderPolicy struct {
	// ToolRoundLimit caps how many provider round-trips a single assistant turn may
	// take while the model keeps requesting tool calls, preventing infinite loops.
	ToolRoundLimit int
	// AllowedMCPApps restricts which MCP servers' tools are offered to the model.
	// An empty slice means no restriction (all enabled servers are offered).
	AllowedMCPApps []string
}

// Provider abstracts a single LLM backend (a configured model block).
//
// Implementations must never log or return the raw API key; callers are responsible
// for decrypting stored credentials immediately before constructing a Provider.
type Provider interface {
	// Name identifies the provider implementation, e.g. "ollama".
	Name() string
	// ChatStream sends a chat request and returns a channel of incremental response
	// chunks. The channel is closed once the final chunk (Done == true) has been sent.
	ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)
	// HealthCheck verifies the provider is reachable and, where applicable, that
	// credentials are valid, without performing a full chat completion.
	HealthCheck(ctx context.Context) HealthResult
}
