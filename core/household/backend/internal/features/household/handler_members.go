package household

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
)

// CreateInvite handles POST /api/v1/households/invite.
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var req CreateInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.CreateInvite(r.Context(), claims.Subject, req)
	if err != nil {
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "only owners and admins can create invite tokens")
			return
		}
		writeServiceError(w, err, "failed to create invite token")
		return
	}

	httpjson.Write(w, http.StatusCreated, res)
}

// ListInvites handles GET /api/v1/households/{id}/invites (OWNER/ADMIN; active invites only).
func (h *Handler) ListInvites(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	res, err := h.service.ListInvites(r.Context(), claims.Subject, chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err, "failed to list invites")
		return
	}
	httpjson.Write(w, http.StatusOK, res)
}

// RevokeInvite handles DELETE /api/v1/households/{id}/invites/{token} (OWNER/ADMIN).
func (h *Handler) RevokeInvite(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	if err := h.service.RevokeInvite(r.Context(), claims.Subject, chi.URLParam(r, "id"), chi.URLParam(r, "token")); err != nil {
		writeServiceError(w, err, "failed to revoke invite")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"message": "invite revoked successfully"})
}

// JoinHousehold handles POST /api/v1/households/join.
func (h *Handler) JoinHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var req JoinHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invite token is required")
		return
	}

	res, err := h.service.JoinHousehold(r.Context(), claims, req.Token)
	if err != nil {
		if errors.Is(err, ErrInviteNotFound) || errors.Is(err, ErrInviteExpiredOrInvalid) {
			httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invite token is invalid or expired")
			return
		}
		if errors.Is(err, ErrMemberAlreadyExists) {
			httpjson.WriteError(w, http.StatusConflict, "conflict", "you are already a member of this household")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to join household")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// UpdateMemberRole handles PUT /api/v1/households/{id}/members/{userID}/role.
func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userID")

	var req UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}

	if err := h.service.UpdateMemberRole(r.Context(), claims.Subject, householdID, targetUserID, HouseholdRole(req.Role)); err != nil {
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized to update member role")
			return
		}
		if errors.Is(err, ErrMemberNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "member not found")
			return
		}
		writeServiceError(w, err, "failed to update member role")
		return
	}

	httpjson.Write(w, http.StatusOK, map[string]string{"message": "member role updated successfully"})
}

// RemoveMember handles DELETE /api/v1/households/{id}/members/{userID}.
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userID")

	if err := h.service.RemoveMember(r.Context(), claims.Subject, householdID, targetUserID); err != nil {
		if errors.Is(err, ErrCannotRemoveOwner) {
			httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "household owner cannot be removed")
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized to remove member")
			return
		}
		if errors.Is(err, ErrMemberNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "member not found")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to remove member")
		return
	}

	httpjson.Write(w, http.StatusOK, map[string]string{"message": "member removed successfully"})
}
