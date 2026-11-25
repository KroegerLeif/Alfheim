package homeassistant

import (
	"errors"
	"log/slog"
	"net/http"

	"alfheim/dashboard/internal/features/plugins"
)

// StatusResponse is the body of GET /api/v1/integrations/home-assistant/status.
// Chat reads it with the user's token to decide whether the household's MCP
// proxy is offered to ALFI; it carries no configuration and no secret.
type StatusResponse struct {
	Enabled bool `json:"enabled"`
	// MCPAvailable is true when the plugin is enabled and has a token, so the
	// MCP proxy can forward requests.
	MCPAvailable bool `json:"mcp_available"`
	// AllowControl mirrors the household's setting, so clients can explain
	// why control tools are missing.
	AllowControl bool `json:"allow_control"`
}

// StatesResponse is the body of GET /api/v1/integrations/home-assistant/states.
type StatesResponse struct {
	Items []EntityState `json:"items"`
}

// MemberHandler serves the member-readable Home Assistant endpoints.
type MemberHandler struct {
	access PluginAccess
	states *States
	log    *slog.Logger
}

// NewMemberHandler returns the handler of the status and states endpoints.
func NewMemberHandler(access PluginAccess, states *States, log *slog.Logger) *MemberHandler {
	return &MemberHandler{access: access, states: states, log: log}
}

// Status answers whether the household's Home Assistant plugin is usable.
func (h *MemberHandler) Status(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, h.log)
	if !ok {
		return
	}
	inst, err := h.access.Instance(r.Context(), hc.HouseholdID, Type)
	switch {
	case errors.Is(err, plugins.ErrNotConfigured):
		writeJSON(w, http.StatusOK, StatusResponse{})
		return
	case errors.Is(err, plugins.ErrEncryptionUnavailable), errors.Is(err, plugins.ErrKeyMismatch):
		// Unreadable credentials make the proxy unusable, not the request invalid.
		enabled, enErr := h.access.IsEnabled(r.Context(), hc.HouseholdID, Type)
		if enErr != nil {
			writePluginErr(w, enErr, h.log)
			return
		}
		writeJSON(w, http.StatusOK, StatusResponse{Enabled: enabled})
		return
	case err != nil:
		writePluginErr(w, err, h.log)
		return
	}
	settings, err := decodeSettings(inst.Config)
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	writeJSON(w, http.StatusOK, StatusResponse{
		Enabled:      inst.Enabled,
		MCPAvailable: inst.Enabled && inst.Credentials[CredentialToken] != "",
		AllowControl: settings.AllowControl,
	})
}

// States answers the pinned entity states of the household.
func (h *MemberHandler) States(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, h.log)
	if !ok {
		return
	}
	items, err := h.states.Pinned(r.Context(), hc.HouseholdID)
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	writeJSON(w, http.StatusOK, StatesResponse{Items: items})
}
