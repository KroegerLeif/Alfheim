// Package mcpservers manages the registry of Fach-App MCP servers the chat backend
// can bridge tool calls to (pantry, chores, maintenance, ...), seeded from the
// CHAT_MCP_SERVERS environment variable at startup.
package mcpservers

import "time"

// Server is a single registered MCP server entry.
type Server struct {
	ID              string
	AppSlug         string
	InternalURL     string
	Enabled         bool
	LastDiscoveryAt *time.Time
	// LastToolsJSON caches the most recent successful tools/list result for display
	// in an admin/debug UI; it is not used as the source of truth for tool-calling
	// (the MCP bridge always queries live, subject to its own short-lived cache).
	LastToolsJSON []byte
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
