package household

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/household/internal/shared/middleware"
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
		r.Patch("/api/v1/households/{id}", h.RenameHousehold)
		r.Delete("/api/v1/households/{id}", h.DeleteHousehold)
		r.Post("/api/v1/households/invite", h.CreateInvite)
		r.Post("/api/v1/households/join", h.JoinHousehold)
		r.Get("/api/v1/households/{id}/invites", h.ListInvites)
		r.Delete("/api/v1/households/{id}/invites/{token}", h.RevokeInvite)
		r.Post("/api/v1/households/{id}/transfer-ownership", h.TransferOwnership)
		r.Post("/api/v1/households/{id}/leave", h.LeaveHousehold)
		r.Put("/api/v1/households/{id}/default", h.SetDefaultHousehold)
		r.Put("/api/v1/households/{id}/members/{userID}/role", h.UpdateMemberRole)
		r.Delete("/api/v1/households/{id}/members/{userID}", h.RemoveMember)
		r.Put("/api/v1/households/{id}/address", h.UpdateHouseholdAddress)
	})
}

// writeJSONError writes a {"error","message"} JSON body with the given status.
func writeJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeServiceError maps domain errors to HTTP responses for the endpoints
// added with the household service; fallback is used for unknown errors.
func writeServiceError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, ErrInvalidRole):
		writeJSONError(w, http.StatusBadRequest, "bad_request", "role must be one of OWNER, ADMIN, MEMBER, GUEST")
	case errors.Is(err, ErrInvalidHouseholdName):
		writeJSONError(w, http.StatusBadRequest, "bad_request", "household name must be 1-150 characters")
	case errors.Is(err, ErrInvalidTransferTarget):
		writeJSONError(w, http.StatusBadRequest, "bad_request", "user_id must be another member of the household")
	case errors.Is(err, ErrOwnerCannotLeave):
		writeJSONError(w, http.StatusBadRequest, "bad_request", ErrOwnerCannotLeave.Error())
	case errors.Is(err, ErrCannotChangeOwnerRole):
		writeJSONError(w, http.StatusBadRequest, "bad_request", ErrCannotChangeOwnerRole.Error())
	case errors.Is(err, ErrCannotRemoveOwner):
		writeJSONError(w, http.StatusBadRequest, "bad_request", "household owner cannot be removed")
	case errors.Is(err, ErrOwnerRoleNotAssignable):
		writeJSONError(w, http.StatusForbidden, "forbidden", ErrOwnerRoleNotAssignable.Error())
	case errors.Is(err, ErrUnauthorizedHouseholdAccess):
		writeJSONError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
	case errors.Is(err, ErrHouseholdNotFound):
		writeJSONError(w, http.StatusNotFound, "not_found", "household not found")
	case errors.Is(err, ErrMemberNotFound):
		writeJSONError(w, http.StatusNotFound, "not_found", "member not found")
	case errors.Is(err, ErrInviteNotFound):
		writeJSONError(w, http.StatusNotFound, "not_found", "invite not found")
	default:
		writeJSONError(w, http.StatusInternalServerError, "internal_server_error", fallback)
	}
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
		if errors.Is(err, ErrInvalidHouseholdName) {
			writeServiceError(w, err, "")
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

// RenameHousehold handles PATCH /api/v1/households/{id} (OWNER/ADMIN).
func (h *Handler) RenameHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req RenameHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.RenameHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id"), req)
	if err != nil {
		writeServiceError(w, err, "failed to rename household")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// DeleteHousehold handles DELETE /api/v1/households/{id} (OWNER only).
func (h *Handler) DeleteHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.DeleteHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to delete household")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "household deleted successfully"})
}

// TransferOwnership handles POST /api/v1/households/{id}/transfer-ownership (OWNER only).
func (h *Handler) TransferOwnership(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req TransferOwnershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.TransferOwnership(r.Context(), claims.Subject, chi.URLParam(r, "id"), req.UserID)
	if err != nil {
		writeServiceError(w, err, "failed to transfer ownership")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// LeaveHousehold handles POST /api/v1/households/{id}/leave (any member except OWNER).
func (h *Handler) LeaveHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.LeaveHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to leave household")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "left household successfully"})
}

// SetDefaultHousehold handles PUT /api/v1/households/{id}/default.
func (h *Handler) SetDefaultHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.SetDefaultHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to set default household")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "default household updated successfully"})
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
		writeServiceError(w, err, "failed to create invite token")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(res)
}

// ListInvites handles GET /api/v1/households/{id}/invites (OWNER/ADMIN; active invites only).
func (h *Handler) ListInvites(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	res, err := h.service.ListInvites(r.Context(), claims.Subject, chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err, "failed to list invites")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// RevokeInvite handles DELETE /api/v1/households/{id}/invites/{token} (OWNER/ADMIN).
func (h *Handler) RevokeInvite(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.RevokeInvite(r.Context(), claims.Subject, chi.URLParam(r, "id"), chi.URLParam(r, "token")); err != nil {
		writeServiceError(w, err, "failed to revoke invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "invite revoked successfully"})
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

	res, err := h.service.JoinHousehold(r.Context(), claims, req.Token)
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
		writeServiceError(w, err, "failed to update member role")
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
