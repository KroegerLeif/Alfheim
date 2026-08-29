package mcpservers

import "time"

// ResponseDTO is the JSON serialization contract for an MCP server registry entry.
type ResponseDTO struct {
	ID              string     `json:"id"`
	AppSlug         string     `json:"app_slug"`
	InternalURL     string     `json:"internal_url"`
	Enabled         bool       `json:"enabled"`
	LastDiscoveryAt *time.Time `json:"last_discovery_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ToResponse converts a Server domain entity to its response DTO.
func ToResponse(s *Server) ResponseDTO {
	return ResponseDTO{
		ID:              s.ID,
		AppSlug:         s.AppSlug,
		InternalURL:     s.InternalURL,
		Enabled:         s.Enabled,
		LastDiscoveryAt: s.LastDiscoveryAt,
		CreatedAt:       s.CreatedAt,
		UpdatedAt:       s.UpdatedAt,
	}
}

// SetEnabledRequest is the payload for PATCH /api/v1/chat/mcp-servers/{id}.
type SetEnabledRequest struct {
	Enabled bool `json:"enabled"`
}

// ServerDiagnosticDTO reports live reachability, latency, and tool discovery details for an MCP server.
type ServerDiagnosticDTO struct {
	ID          string   `json:"id"`
	AppSlug     string   `json:"app_slug"`
	EndpointURL string   `json:"endpoint_url"`
	Enabled     bool     `json:"enabled"`
	Reachable   bool     `json:"reachable"`
	LatencyMs   int64    `json:"latency_ms"`
	ToolsCount  int      `json:"tools_count"`
	Tools       []string `json:"tools,omitempty"`
	ProtocolVer string   `json:"protocol_version,omitempty"`
	Error       string   `json:"error,omitempty"`
}
