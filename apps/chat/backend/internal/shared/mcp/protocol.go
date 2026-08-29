// Package mcp implements a minimal client for the Model Context Protocol's Streamable
// HTTP transport, used to talk to the FastMCP servers already mounted at /mcp by the
// Pantry, Chores, and Maintenance backends (see e.g. apps/pantry/backend/src/mcp/server.py).
package mcp

import "encoding/json"

// protocolVersion is the MCP protocol version this client negotiates. It must be one
// of mcp.shared.version.SUPPORTED_PROTOCOL_VERSIONS on the Python/FastMCP side.
const protocolVersion = "2025-06-18"

// HTTP header names used by the MCP Streamable HTTP transport (see
// mcp.server.streamable_http in the Python `mcp` SDK backing FastMCP).
const (
	headerAccept          = "Accept"
	headerContentType     = "Content-Type"
	headerSessionID       = "Mcp-Session-Id"
	headerProtocolVersion = "Mcp-Protocol-Version"

	contentTypeJSON = "application/json"
	contentTypeSSE  = "text/event-stream"
)

// jsonRPCRequest is a single JSON-RPC 2.0 request or notification. Notifications omit ID.
type jsonRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      *int64 `json:"id,omitempty"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

// jsonRPCMessage is a JSON-RPC 2.0 response or error, as returned by the server.
type jsonRPCMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// initializeParams are the params sent with the "initialize" request.
type initializeParams struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    map[string]any     `json:"capabilities"`
	ClientInfo      implementationInfo `json:"clientInfo"`
}

type implementationInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type initializeResult struct {
	ProtocolVersion string `json:"protocolVersion"`
}

// Tool describes a single MCP tool, as returned by "tools/list".
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

type listToolsResult struct {
	Tools []Tool `json:"tools"`
}

type callToolParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

type contentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type callToolResult struct {
	Content []contentBlock `json:"content"`
	IsError bool           `json:"isError"`
}
