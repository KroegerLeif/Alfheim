package modelblocks

import (
	"encoding/json"
	"net/http"

	"alfheim/go-shared/auth"
)

// GetHouseholdDefault answers GET /api/v1/chat/model-blocks/household-default
// with the household's default shared model block, or 404 when there is none.
// Every member may read it; the response carries has_api_key, never the key.
func (h *Handler) GetHouseholdDefault(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}
	block, err := h.service.HouseholdDefault(r.Context(), claims.Subject, householdOf(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, block)
}

// PutHouseholdDefault answers PUT /api/v1/chat/model-blocks/household-default:
// it creates (201) or updates (200) the household's default shared model block.
// household.RequireHouseholdRole admits only OWNER and ADMIN.
func (h *Handler) PutHouseholdDefault(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}
	var req HouseholdDefaultRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}
	block, created, err := h.service.SaveHouseholdDefault(r.Context(), claims.Subject, householdOf(r), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeJSON(w, status, block)
}
