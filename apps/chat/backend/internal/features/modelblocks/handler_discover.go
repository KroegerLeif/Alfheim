package modelblocks

import (
	"encoding/json"
	"errors"
	"net/http"

	"alfheim/go-shared/auth"
)

// Discover lists the models a provider endpoint offers.
func (h *Handler) Discover(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}
	_ = claims

	var req DiscoverRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
			return
		}
	}

	result, err := h.service.DiscoverModels(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidBaseURL), errors.Is(err, ErrDiscoveryUnsupported):
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		default:
			// Details are logged by the service; upstream errors must not reach the client.
			writeError(w, http.StatusBadGateway, "discovery_failed", ErrDiscoveryFailed.Error())
		}
		return
	}

	writeJSON(w, http.StatusOK, result)
}
