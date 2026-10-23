package mcpservers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/mcp"
	"alfheim/chat/internal/shared/middleware"
)

// Handler manages MCP server registry HTTP endpoints (admin/debug visibility).
type Handler struct {
	service Service
	pool    MCPClientPool
}

// NewHandler creates an mcpservers HTTP handler.
func NewHandler(service Service, pool MCPClientPool) *Handler {
	return &Handler{service: service, pool: pool}
}

// RegisterRoutes mounts MCP server registry endpoints on a chi Router, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/chat/mcp-servers", h.List)
		r.With(middleware.RequireOperator).Get("/api/v1/chat/mcp-servers/diagnostics", h.Diagnostics)
		r.With(middleware.RequireOperator).Patch("/api/v1/chat/mcp-servers/{id}", h.SetEnabled)
	})
}

// List returns the registry. The registry is global to the installation, so
// only operators see internal endpoint URLs and timestamps; every other user
// gets the non-sensitive summary (id, app slug, enabled state).
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	servers, err := h.service.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to list mcp servers")
		return
	}
	if !middleware.IsOperator(r.Context()) {
		summaries := make([]SummaryDTO, 0, len(servers))
		for _, s := range servers {
			summaries = append(summaries, ToSummary(s))
		}
		writeJSON(w, http.StatusOK, summaries)
		return
	}
	writeJSON(w, http.StatusOK, servers)
}

// Diagnostics probes every registered MCP server. Operator-only: the report
// contains internal endpoint URLs and error details.
func (h *Handler) Diagnostics(w http.ResponseWriter, r *http.Request) {
	// Probe the MCP servers as the calling user, since they authorize every request.
	ctx := r.Context()
	claims, cErr := middleware.GetUserClaims(ctx)
	hc, hErr := middleware.GetHousehold(ctx)
	if cErr == nil && hErr == nil {
		ctx = mcp.WithCallerCredentials(ctx, mcp.CallerCredentials{AccessToken: claims.AccessToken, HouseholdID: hc.HouseholdID.String(), UserID: claims.Subject})
	}

	diags, err := h.service.DiagnoseServers(ctx, h.pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to run mcp server diagnostics")
		return
	}
	writeJSON(w, http.StatusOK, diags)
}

// SetEnabled toggles a registry entry. Operator-only.
func (h *Handler) SetEnabled(w http.ResponseWriter, r *http.Request) {
	// The registry is global to the installation, so toggling it is reserved for
	// operators (route-level RequireOperator); household roles do not apply.
	id := chi.URLParam(r, "id")

	var req SetEnabledRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	updated, err := h.service.SetEnabled(r.Context(), id, req.Enabled)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "mcp server not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to update mcp server")
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
