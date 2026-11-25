package modelblocks

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/go-shared/household"
)

// writeServiceError maps domain errors to their corresponding HTTP status codes.
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "model block not found")
	case errors.Is(err, ErrBootstrapReadOnly):
		writeError(w, http.StatusForbidden, "bootstrap_read_only", err.Error())
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, ErrInvalidBaseURL):
		// A distinct code lets clients explain CHAT_ALLOWED_LLM_HOSTS instead of a generic error.
		writeError(w, http.StatusBadRequest, "invalid_base_url", err.Error())
	case errors.Is(err, ErrAPIKeyRequiredForBaseURLChange):
		writeError(w, http.StatusBadRequest, "api_key_required", err.Error())
	case errors.Is(err, ErrMissingHouseholdID), errors.Is(err, ErrInvalidVisibility), errors.Is(err, ErrInvalidProviderType),
		errors.Is(err, ErrModelIdentifierRequired):
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
	case errors.Is(err, ErrEncryptionKeyMissing):
		writeError(w, http.StatusUnprocessableEntity, "encryption_unavailable", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to process model block request")
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

// householdOf returns the verified household id set by household.RequireHousehold,
// or "" when the request carries no household scope (the service then refuses any
// household-shared operation).
func householdOf(r *http.Request) string {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		return ""
	}
	return hc.HouseholdID.String()
}
