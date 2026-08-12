package apps

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"alfheim/dashboard/internal/shared/middleware"
)

// Handler manages 3-tier app catalog and user preferences HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates new 3-tier apps handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers endpoints on the chi router with auth middleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		// Dashboard unified apps endpoints
		r.Get("/api/v1/apps", h.GetDashboardApps)
		r.Get("/api/v1/apps/dashboard", h.GetDashboardApps)

		// User Preferences endpoints
		r.Get("/api/v1/user/preferences", h.GetUserPreferences)
		r.Put("/api/v1/user/preferences", h.UpdateUserPreferences)
		r.Patch("/api/v1/user/preferences", h.UpdateUserPreferences)

		// Tier 3 User Links endpoints
		r.Get("/api/v1/user/links", h.GetUserLinks)
		r.Post("/api/v1/user/links", h.CreateUserLink)
		r.Put("/api/v1/user/links/{id}", h.UpdateUserLink)
		r.Delete("/api/v1/user/links/{id}", h.DeleteUserLink)
	})
}

// GetDashboardApps serves unified 3-tier dashboard applications (Core, Stack, User Links).
func (h *Handler) GetDashboardApps(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	dashboard, err := h.service.GetDashboardApps(r.Context(), claims.Subject, claims.Roles)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to retrieve dashboard apps"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dashboard)
}

// GetUserPreferences retrieves the user's settings (e.g. hidden Core Apps).
func (h *Handler) GetUserPreferences(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	prefs, err := h.service.GetUserPreferences(r.Context(), claims.Subject)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to retrieve user preferences"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(prefs)
}

// UpdateUserPreferences updates user settings (e.g. hidden Core Apps list).
func (h *Handler) UpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req UpdateUserPreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	prefs, err := h.service.UpdateUserPreferences(r.Context(), claims.Subject, req.HiddenAppIDs)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to update user preferences"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(prefs)
}

// GetUserLinks lists custom Tier 3 user links.
func (h *Handler) GetUserLinks(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	dashboard, err := h.service.GetDashboardApps(r.Context(), claims.Subject, claims.Roles)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to retrieve user links"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dashboard.User)
}

// CreateUserLink creates a new custom Tier 3 user link.
func (h *Handler) CreateUserLink(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateUserLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	createdItem, err := h.service.CreateUserLink(r.Context(), claims.Subject, req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createdItem)
}

// UpdateUserLink updates an existing custom Tier 3 user link.
func (h *Handler) UpdateUserLink(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"bad_request","message":"link id required"}`, http.StatusBadRequest)
		return
	}

	var req UpdateUserLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	updatedItem, err := h.service.UpdateUserLink(r.Context(), claims.Subject, id, req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, ErrLinkNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "user link not found"})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updatedItem)
}

// DeleteUserLink removes a custom Tier 3 user link.
func (h *Handler) DeleteUserLink(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"bad_request","message":"link id required"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteUserLink(r.Context(), claims.Subject, id); err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, ErrLinkNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "user link not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
