package contact

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/household/internal/features/household"
	"github.com/go-chi/chi/v5"

	"alfheim/household/internal/shared/httpjson"
	"alfheim/household/internal/shared/middleware"
)

// CreateCategory handles POST /api/v1/households/{id}/contact-categories.
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
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

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.CreateCategory(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "only owners and admins can create categories")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to create category")
		return
	}

	httpjson.Write(w, http.StatusCreated, res)
}

// GetCategories handles GET /api/v1/households/{id}/contact-categories.
func (h *Handler) GetCategories(w http.ResponseWriter, r *http.Request) {
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

	res, err := h.service.GetCategories(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to fetch categories")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// UpdateCategory handles PUT /api/v1/households/{id}/contact-categories/{catId}.
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	catID := chi.URLParam(r, "catId")

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.UpdateCategory(r.Context(), claims.Subject, householdID, catID, req)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to category")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to update category")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// DeleteCategory handles DELETE /api/v1/households/{id}/contact-categories/{catId}.
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	catID := chi.URLParam(r, "catId")

	err = h.service.DeleteCategory(r.Context(), claims.Subject, householdID, catID)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to category")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to delete category")
		return
	}

	httpjson.Write(w, http.StatusOK, map[string]string{"message": "category deleted successfully"})
}
