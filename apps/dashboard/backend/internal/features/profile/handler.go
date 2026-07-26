package profile

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"loeger-os/dashboard/internal/shared/middleware"
)

// Handler manages profile HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates a profile HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts profile endpoints on a chi Router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/profile/me", h.GetMyProfile)
		r.Put("/api/v1/profile/me", h.UpdateMyProfile)
	})
}

// GetMyProfile fetches the authenticated user's profile, syncing OIDC claims if necessary.
func (h *Handler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	p, err := h.service.SyncProfileFromClaims(r.Context(), claims)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to sync profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ToResponse(p))
}

// UpdateMyProfile updates the authenticated user's profile metadata.
func (h *Handler) UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var dto UpdateDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json request payload"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), claims.Subject, dto)
	if err != nil {
		if errors.Is(err, ErrProfileNotFound) {
			http.Error(w, `{"error":"not_found","message":"profile not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to update profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ToResponse(updated))
}
