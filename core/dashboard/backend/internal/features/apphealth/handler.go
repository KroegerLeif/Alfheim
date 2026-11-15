package apphealth

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Handler serves the app health endpoint.
type Handler struct {
	service Service
}

// NewHandler creates an app health handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts GET /api/v1/apps/health, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/apps/health", h.Get)
	})
}

// Get handles GET /api/v1/apps/health: the cached live state of every
// enabled app backend ({"apps": {"<id>": "online|degraded|offline"}}).
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(h.service.Snapshot(r.Context()))
}
