package mcpservers

import "errors"

var (
	// ErrNotFound indicates the requested MCP server registry entry does not exist.
	ErrNotFound = errors.New("mcp server not found")
	// ErrInvalidSeedSpec indicates a CHAT_MCP_SERVERS entry was malformed.
	ErrInvalidSeedSpec = errors.New("invalid CHAT_MCP_SERVERS entry, expected format app_slug=url")
)
