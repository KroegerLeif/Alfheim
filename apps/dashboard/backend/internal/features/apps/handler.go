package apps

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"loeger-os/dashboard/internal/shared/middleware"
)

// Handler manages app catalog HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates new app catalog handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers app catalog endpoints on the chi router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/apps", h.GetAppCatalog)
	})
}

// GetAppCatalog serves allowed catalog applications for the current user.
func (h *Handler) GetAppCatalog(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	catalog, err := h.service.GetAppCatalog(r.Context(), claims.Roles)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to retrieve app catalog"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(catalog)
}
