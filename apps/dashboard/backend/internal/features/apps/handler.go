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

// RegisterRoutes registers app catalog endpoints on the chi router with auth middleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/apps", h.GetAppCatalog)
		r.Post("/api/v1/apps", h.CreateApp)
	})
}

// GetAppCatalog serves permitted catalog applications for the current user.
func (h *Handler) GetAppCatalog(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdRole := r.Header.Get("X-Household-Role")
	if householdRole == "" {
		householdRole = r.URL.Query().Get("household_role")
	}
	if householdRole == "" {
		householdRole = "MEMBER"
	}

	catalog, err := h.service.GetPermittedApps(r.Context(), claims.Roles, householdRole)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to retrieve app catalog"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(catalog)
}

// CreateApp registers a new application in the catalog.
func (h *Handler) CreateApp(w http.ResponseWriter, r *http.Request) {
	var req CreateAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	createdApp, err := h.service.CreateApp(r.Context(), req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createdApp)
}
