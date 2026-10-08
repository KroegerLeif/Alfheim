package household

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
)

// TransferOwnership handles POST /api/v1/households/{id}/transfer-ownership (OWNER only).
func (h *Handler) TransferOwnership(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var req TransferOwnershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.TransferOwnership(r.Context(), claims.Subject, chi.URLParam(r, "id"), req.UserID)
	if err != nil {
		writeServiceError(w, err, "failed to transfer ownership")
		return
	}
	httpjson.Write(w, http.StatusOK, res)
}

// LeaveHousehold handles POST /api/v1/households/{id}/leave (any member except OWNER).
func (h *Handler) LeaveHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	if err := h.service.LeaveHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to leave household")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"message": "left household successfully"})
}

// SetDefaultHousehold handles PUT /api/v1/households/{id}/default.
func (h *Handler) SetDefaultHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	if err := h.service.SetDefaultHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to set default household")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"message": "default household updated successfully"})
}
