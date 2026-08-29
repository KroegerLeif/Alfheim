package mcpservers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
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
		r.Get("/api/v1/chat/mcp-servers/diagnostics", h.Diagnostics)
		r.Patch("/api/v1/chat/mcp-servers/{id}", h.SetEnabled)
	})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	servers, err := h.service.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to list mcp servers")
		return
	}
	writeJSON(w, http.StatusOK, servers)
}

func (h *Handler) Diagnostics(w http.ResponseWriter, r *http.Request) {
	diags, err := h.service.DiagnoseServers(r.Context(), h.pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to run mcp server diagnostics")
		return
	}
	writeJSON(w, http.StatusOK, diags)
}

func (h *Handler) SetEnabled(w http.ResponseWriter, r *http.Request) {
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
