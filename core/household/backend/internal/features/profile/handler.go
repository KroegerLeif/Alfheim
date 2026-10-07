package profile

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
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
		httpjson.WriteUnauthorized(w)
		return
	}

	p, err := h.service.SyncProfileFromClaims(r.Context(), claims)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to sync profile")
		return
	}

	httpjson.Write(w, http.StatusOK, ToResponse(p))
}

// UpdateMyProfile updates the authenticated user's profile metadata.
func (h *Handler) UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var dto UpdateDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), claims.Subject, dto)
	if err != nil {
		if errors.Is(err, ErrProfileNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "profile not found")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to update profile")
		return
	}

	httpjson.Write(w, http.StatusOK, ToResponse(updated))
}
