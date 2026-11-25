package mcpservers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"alfheim/chat/internal/shared/mcp"
)

// HomeAssistantSlug is the app slug of the dashboard's Home Assistant MCP
// proxy. A model block's MCP allowlist names it like any other app.
const HomeAssistantSlug = "homeassistant"

// Dashboard paths of the Home Assistant plugin (#957).
const (
	haStatusPath = "/api/v1/integrations/home-assistant/status"
	haMCPPath    = "/api/v1/integrations/home-assistant/mcp"
)

// errSourceUnavailable means a household source could not answer.
var errSourceUnavailable = errors.New("household mcp source unavailable")

// HouseholdSource lists MCP servers that exist only for some households. It
// reads the caller's household and token from mcp.CallerCredentialsFrom(ctx),
// so one household's servers are never listed for another.
type HouseholdSource interface {
	HouseholdServers(ctx context.Context) ([]mcp.ServerRef, error)
}

// DashboardHomeAssistant offers the dashboard's Home Assistant MCP proxy to
// households whose plugin is enabled (ADR 0010 §4). It asks the dashboard's
// member-readable status endpoint with the user's own token and household;
// the dashboard confirms the membership. The Home Assistant token never
// reaches chat.
type DashboardHomeAssistant struct {
	baseURL string
	client  *http.Client
}

// NewDashboardHomeAssistant returns the source for the dashboard at baseURL
// (CHAT_DASHBOARD_URL).
func NewDashboardHomeAssistant(baseURL string, client *http.Client) *DashboardHomeAssistant {
	return &DashboardHomeAssistant{baseURL: strings.TrimRight(baseURL, "/"), client: client}
}

// HouseholdServers returns the proxy when the caller's household has the
// plugin enabled with a token, and nothing without caller credentials.
func (d *DashboardHomeAssistant) HouseholdServers(ctx context.Context) ([]mcp.ServerRef, error) {
	creds, ok := mcp.CallerCredentialsFrom(ctx)
	if !ok || creds.HouseholdID == "" || creds.AccessToken == "" {
		return nil, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.baseURL+haStatusPath, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errSourceUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+creds.AccessToken)
	req.Header.Set("X-Household-ID", creds.HouseholdID)
	req.Header.Set("Accept", "application/json")
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errSourceUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", errSourceUnavailable, resp.StatusCode)
	}
	var status struct {
		MCPAvailable bool `json:"mcp_available"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&status); err != nil {
		return nil, fmt.Errorf("%w: %w", errSourceUnavailable, err)
	}
	if !status.MCPAvailable {
		return nil, nil
	}
	// No registry row: ID stays empty, so tool results carry no mcp_server_id.
	return []mcp.ServerRef{{Slug: HomeAssistantSlug, EndpointURL: d.baseURL + haMCPPath}}, nil
}
