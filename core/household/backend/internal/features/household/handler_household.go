package household

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
)

// CreateHousehold handles POST /api/v1/households.
func (h *Handler) CreateHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var req CreateHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.CreateHousehold(r.Context(), claims, req)
	if err != nil {
		if errors.Is(err, ErrHouseholdSlugExists) {
			httpjson.WriteError(w, http.StatusConflict, "conflict", "household slug already in use")
			return
		}
		if errors.Is(err, ErrInvalidHouseholdName) {
			writeServiceError(w, err, "")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to create household")
		return
	}

	httpjson.Write(w, http.StatusCreated, res)
}

// GetMyHouseholds handles GET /api/v1/households/me.
func (h *Handler) GetMyHouseholds(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	res, err := h.service.GetUserHouseholds(r.Context(), claims.Subject)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to fetch user households")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// GetHouseholdDetails handles GET /api/v1/households/{id}.
func (h *Handler) GetHouseholdDetails(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "missing household id")
		return
	}

	res, err := h.service.GetHouseholdDetails(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, ErrHouseholdNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "household not found")
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to fetch household details")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// RenameHousehold handles PATCH /api/v1/households/{id} (OWNER/ADMIN).
func (h *Handler) RenameHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	var req RenameHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.RenameHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id"), req)
	if err != nil {
		writeServiceError(w, err, "failed to rename household")
		return
	}
	httpjson.Write(w, http.StatusOK, res)
}

// DeleteHousehold handles DELETE /api/v1/households/{id} (OWNER only).
func (h *Handler) DeleteHousehold(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	if err := h.service.DeleteHousehold(r.Context(), claims.Subject, chi.URLParam(r, "id")); err != nil {
		writeServiceError(w, err, "failed to delete household")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"message": "household deleted successfully"})
}

// UpdateHouseholdAddress handles PUT /api/v1/households/{id}/address.
func (h *Handler) UpdateHouseholdAddress(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	if householdID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "missing household id")
		return
	}

	var req UpdateHouseholdAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	err = h.service.UpdateHouseholdAddress(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, ErrHouseholdNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "household not found")
			return
		}
		if errors.Is(err, ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to update household address")
		return
	}

	httpjson.Write(w, http.StatusOK, map[string]string{"message": "household address updated successfully"})
}
