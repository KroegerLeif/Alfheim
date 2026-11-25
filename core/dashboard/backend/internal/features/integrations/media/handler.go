package media

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/household"
)

// Error codes of the media endpoints, answered as {"detail": {"code", "message"}}.
const (
	CodeNotMediaType           = "media_type_unknown"
	CodeNotConfigured          = "media_not_configured"
	CodeDisabled               = "media_disabled"
	CodeControlUnsupported     = "media_control_unsupported"
	CodeInvalidCommand         = "media_command_invalid"
	CodeInvalidSession         = "media_session_invalid"
	CodeSessionNotFound        = "media_session_not_found"
	CodeCredentialsUnavailable = "media_credentials_unavailable"
	CodeUpstream               = "media_upstream_error"
	CodeInternal               = "internal_error"
)

// Handler serves the media API.
type Handler struct {
	svc *Service
	log *slog.Logger
}

// NewHandler returns the media HTTP handler.
func NewHandler(svc *Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts the media routes. authMw validates the bearer token,
// householdMw confirms the X-Household-ID membership against core/household.
// Every member reads now playing; OWNER, ADMIN and MEMBER control playback.
func (h *Handler) RegisterRoutes(r chi.Router, authMw, householdMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw, householdMw)
		r.Get("/api/v1/integrations/media/now-playing", h.NowPlaying)
		r.With(household.RequireHouseholdRole(h.log, household.RoleOwner, household.RoleAdmin, household.RoleMember)).
			Post("/api/v1/integrations/media/{type}/sessions/{id}/{command}", h.Control)
	})
}

// NowPlaying answers GET /api/v1/integrations/media/now-playing.
func (h *Handler) NowPlaying(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	body, err := h.svc.NowPlaying(r.Context(), hc.HouseholdID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

// Control answers POST /api/v1/integrations/media/{type}/sessions/{id}/{command}
// with 204 once the media server accepted the command.
func (h *Handler) Control(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	err := h.svc.Control(r.Context(), hc.HouseholdID, chi.URLParam(r, "type"),
		chi.URLParam(r, "id"), Command(chi.URLParam(r, "command")))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) householdContext(w http.ResponseWriter, r *http.Request) (*household.HouseholdContext, bool) {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		h.log.Error("media route without household context; RequireHousehold must run first")
		writeError(w, http.StatusInternalServerError, household.CodeHouseholdContextMissing, "household context is missing")
		return nil, false
	}
	return hc, true
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotMediaType), errors.Is(err, plugins.ErrUnknownType):
		writeError(w, http.StatusNotFound, CodeNotMediaType, "plugin type is not a media server")
	case errors.Is(err, plugins.ErrNotConfigured):
		writeError(w, http.StatusNotFound, CodeNotConfigured, "media server is not configured for this household")
	case errors.Is(err, plugins.ErrDisabled):
		writeError(w, http.StatusConflict, CodeDisabled, "media server is disabled for this household")
	case errors.Is(err, ErrControlUnsupported):
		writeError(w, http.StatusConflict, CodeControlUnsupported, "media server does not support playback control")
	case errors.Is(err, ErrInvalidCommand):
		writeError(w, http.StatusBadRequest, CodeInvalidCommand, "command must be play_pause, next, previous or stop")
	case errors.Is(err, ErrInvalidSession):
		writeError(w, http.StatusBadRequest, CodeInvalidSession, "session id is invalid")
	case errors.Is(err, ErrSessionNotFound):
		writeError(w, http.StatusNotFound, CodeSessionNotFound, "media session not found")
	case errors.Is(err, plugins.ErrEncryptionUnavailable), errors.Is(err, plugins.ErrKeyMismatch),
		errors.Is(err, ErrMissingCredentials):
		writeError(w, http.StatusServiceUnavailable, CodeCredentialsUnavailable, "media server credentials are unavailable")
	default:
		code := failureCode(err)
		if code == "error" {
			h.log.Error("media request failed", slog.String("error", err.Error()))
			writeError(w, http.StatusInternalServerError, CodeInternal, "the media request could not be completed")
			return
		}
		h.log.Warn("media server call failed", slog.String("reason", code), slog.String("error", err.Error()))
		writeJSON(w, http.StatusBadGateway, map[string]any{"detail": map[string]string{
			"code": CodeUpstream, "message": "the media server call failed", "reason": code,
		}})
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"detail": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The status line is already sent, so an encoding failure (a gone client)
	// cannot be reported to the caller any more.
	_ = json.NewEncoder(w).Encode(body)
}
