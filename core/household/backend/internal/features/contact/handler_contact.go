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

// CreateContact handles POST /api/v1/households/{id}/contacts.
func (h *Handler) CreateContact(w http.ResponseWriter, r *http.Request) {
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

	var req CreateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.CreateContact(r.Context(), claims.Subject, householdID, req)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "only owners, admins, and members can create contacts")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to create contact")
		return
	}

	httpjson.Write(w, http.StatusCreated, res)
}

// GetContacts handles GET /api/v1/households/{id}/contacts.
func (h *Handler) GetContacts(w http.ResponseWriter, r *http.Request) {
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

	res, err := h.service.GetContacts(r.Context(), claims.Subject, householdID)
	if err != nil {
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to household")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to fetch contacts")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// UpdateContact handles PUT /api/v1/households/{id}/contacts/{contactId}.
func (h *Handler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	contactID := chi.URLParam(r, "contactId")

	var req CreateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	res, err := h.service.UpdateContact(r.Context(), claims.Subject, householdID, contactID, req)
	if err != nil {
		if errors.Is(err, ErrContactNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "contact not found")
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to contact")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to update contact")
		return
	}

	httpjson.Write(w, http.StatusOK, res)
}

// DeleteContact handles DELETE /api/v1/households/{id}/contacts/{contactId}.
func (h *Handler) DeleteContact(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}

	householdID := chi.URLParam(r, "id")
	contactID := chi.URLParam(r, "contactId")

	err = h.service.DeleteContact(r.Context(), claims.Subject, householdID, contactID)
	if err != nil {
		if errors.Is(err, ErrContactNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, "not_found", "contact not found")
			return
		}
		if errors.Is(err, household.ErrUnauthorizedHouseholdAccess) {
			httpjson.WriteError(w, http.StatusForbidden, "forbidden", "unauthorized access to contact")
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", "failed to delete contact")
		return
	}

	httpjson.Write(w, http.StatusOK, map[string]string{"message": "contact deleted successfully"})
}
