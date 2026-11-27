package homeassistant

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/household"
)

// Error codes of the Home Assistant endpoints, answered as
// {"detail": {"code", "message"}} like the plugin API.
const (
	CodeNotEnabled     = "home_assistant_not_enabled"
	CodeHostNotAllowed = "home_assistant_host_not_allowed"
	CodeAuthRejected   = "home_assistant_auth_failed"
	CodeUpstream       = "home_assistant_unavailable"
	CodeCredentials    = "home_assistant_credentials_unavailable"
	CodeInvalidBody    = "invalid_body"
	CodeInternal       = "internal_error"
)

// householdFrom returns the household RequireHousehold confirmed.
func householdFrom(w http.ResponseWriter, r *http.Request, log *slog.Logger) (*household.HouseholdContext, bool) {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		log.Error("home assistant route without household context; RequireHousehold must run first")
		writeError(w, http.StatusInternalServerError, household.CodeHouseholdContextMissing, "household context is missing")
		return nil, false
	}
	return hc, true
}

// writePluginErr answers a failed access to the household's plugin. Messages
// are fixed texts: an upstream error is never echoed.
func writePluginErr(w http.ResponseWriter, err error, log *slog.Logger) {
	switch {
	case errors.Is(err, plugins.ErrNotConfigured), errors.Is(err, plugins.ErrDisabled), errors.Is(err, plugins.ErrUnknownType):
		writeError(w, http.StatusNotFound, CodeNotEnabled, "Home Assistant is not enabled for this household")
	case errors.Is(err, plugins.ErrHostNotAllowed):
		writeError(w, http.StatusBadGateway, CodeHostNotAllowed, "the Home Assistant address is not in INTEGRATIONS_ALLOWED_HOSTS")
	case errors.Is(err, ErrAuthRejected):
		writeError(w, http.StatusBadGateway, CodeAuthRejected, "Home Assistant rejected the stored access token")
	case errors.Is(err, ErrUpstream):
		writeError(w, http.StatusBadGateway, CodeUpstream, "Home Assistant could not be reached")
	case errors.Is(err, plugins.ErrEncryptionUnavailable), errors.Is(err, plugins.ErrKeyMismatch):
		writeError(w, http.StatusServiceUnavailable, CodeCredentials, "the Home Assistant credentials cannot be read")
	default:
		log.Error("home assistant request failed", slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, CodeInternal, "the request could not be completed")
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"detail": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The status line is already sent; an encoding failure means a gone client.
	_ = json.NewEncoder(w).Encode(body)
}
