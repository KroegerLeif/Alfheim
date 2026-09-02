package household

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/dashboard/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
)

// Handler manages HTTP endpoints for the household domain.
type Handler struct {
	service Service
}

// NewHandler constructs a household HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts household REST endpoints onto a chi router with auth middleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/households", h.CreateHousehold)
		r.Get("/api/v1/households/me", h.GetMyHouseholds)
		r.Get("/api/v1/households/{id}", h.GetHouseholdDetails)
		r.Post("/api/v1/households/invite", h.CreateInvite)
		r.Post("/api/v1/households/join", h.JoinHousehold)
		r.Put("/api/v1/households/{id}/members/{userID}/role", h.UpdateMemberRole)
		r.Delete("/api/v1/households/{id}/members/{userID}", h.RemoveMember)
		r.Put("/api/v1/households/{id}/address", h.UpdateHouseholdAddress)
	})
}

// CreateHousehold handles POST /api/v1/households.
func (h *Handler) CreateHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.CreateHousehold(r.Context(), claims, req)
	if err != nil {
		if errors.Is(err, ErrHouseholdSlugExists) {
			http.Error(w, `{"error":"conflict","message":"household slug already in use"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to create household"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

// GetMyHouseholds handles GET /api/v1/households/me.
func (h *Handler) GetMyHouseholds(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	res, err := h.service.GetUserHouseholds(r.Context(), claims.Subject)
	if err != nil {
		http.Error(w, `{"error":"internal_server_error","message":"failed to fetch user households"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// GetHouseholdDetails handles GET /api/v1/households/{id}.
func (h *Handler) GetHouseholdDetails(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.GetHouseholdDetails(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, ErrHouseholdNotFound) {
			http.Error(w, `{"error":"not_found","message":"household not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to household"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to fetch household details"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// CreateInvite handles POST /api/v1/households/invite.
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.CreateInvite(r.Context(), claims.Subject, req)
	if err != nil {
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"only owners and admins can create invite tokens"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to create invite token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

// JoinHousehold handles POST /api/v1/households/join.
func (h *Handler) JoinHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req JoinHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		http.Error(w, `{"error":"bad_request","message":"invite token is required"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.JoinHousehold(r.Context(), claims.Subject, req.Token)
	if err != nil {
		if errors.Is(err, ErrInviteNotFound) || errors.Is(err, ErrInviteExpiredOrInvalid) {
			http.Error(w, `{"error":"bad_request","message":"invite token is invalid or expired"}`, http.StatusBadRequest)
			return
		}
		if errors.Is(err, ErrMemberAlreadyExists) {
			http.Error(w, `{"error":"conflict","message":"you are already a member of this household"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to join household"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// UpdateMemberRole handles PUT /api/v1/households/{id}/members/{userID}/role.
func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userID")

	var req UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateMemberRole(r.Context(), claims.Subject, householdID, targetUserID, HouseholdRole(req.Role)); err != nil {
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized to update member role"}`, http.StatusForbidden)
			return
		}
		if errors.Is(err, ErrMemberNotFound) {
			http.Error(w, `{"error":"not_found","message":"member not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to update member role"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "member role updated successfully"})
}

// RemoveMember handles DELETE /api/v1/households/{id}/members/{userID}.
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userID")

	if err := h.service.RemoveMember(r.Context(), claims.Subject, householdID, targetUserID); err != nil {
		if errors.Is(err, ErrCannotRemoveOwner) {
			http.Error(w, `{"error":"bad_request","message":"household owner cannot be removed"}`, http.StatusBadRequest)
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized to remove member"}`, http.StatusForbidden)
			return
		}
		if errors.Is(err, ErrMemberNotFound) {
			http.Error(w, `{"error":"not_found","message":"member not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to remove member"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "member removed successfully"})
}

// UpdateHouseholdAddress handles PUT /api/v1/households/{id}/address.
func (h *Handler) UpdateHouseholdAddress(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		http.Error(w, `{"error":"bad_request","message":"missing household id"}`, http.StatusBadRequest)
		return
	}

	var req UpdateHouseholdAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad_request","message":"invalid json payload"}`, http.StatusBadRequest)
		return
	}

	err = h.service.UpdateHouseholdAddress(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, ErrHouseholdNotFound) {
			http.Error(w, `{"error":"not_found","message":"household not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			http.Error(w, `{"error":"forbidden","message":"unauthorized access to household"}`, http.StatusForbidden)
			return
		}
		http.Error(w, `{"error":"internal_server_error","message":"failed to update household address"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "household address updated successfully"})
}
