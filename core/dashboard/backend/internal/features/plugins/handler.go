package plugins

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/household"
)

// Error codes of the plugin endpoints, answered as {"detail": {"code", "message"}}.
const (
	CodeValidation            = "validation_error"
	CodeInvalidBody           = "invalid_body"
	CodeUnknownType           = "plugin_type_unknown"
	CodeNotConfigured         = "plugin_not_configured"
	CodeEncryptionUnavailable = "integrations_encryption_unavailable"
	CodeInternal              = "internal_error"
	CodeHouseholdCtx          = household.CodeHouseholdContextMissing
)

// Handler serves the household plugin API.
type Handler struct {
	svc *Service
	log *slog.Logger
}

// NewHandler returns the plugin HTTP handler.
func NewHandler(svc *Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts the plugin routes. authMw validates the bearer token,
// householdMw confirms the X-Household-ID membership against core/household.
// Every member may list plugins; only OWNER and ADMIN may change or test them.
func (h *Handler) RegisterRoutes(r chi.Router, authMw, householdMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw, householdMw)
		r.Get("/api/v1/integrations/plugins", h.List)

		r.Group(func(r chi.Router) {
			r.Use(household.RequireHouseholdRole(h.log, household.RoleOwner, household.RoleAdmin))
			r.Put("/api/v1/integrations/plugins/{type}", h.Update)
			r.Post("/api/v1/integrations/plugins/{type}/test", h.Test)
		})
	})
}

// List answers GET /api/v1/integrations/plugins with every registered type.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	views, err := h.svc.List(r.Context(), hc.HouseholdID)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	items := make([]PluginResponse, 0, len(views))
	for _, v := range views {
		items = append(items, toResponse(v))
	}
	writeJSON(w, http.StatusOK, ListResponse{Items: items, EncryptionAvailable: h.svc.EncryptionAvailable()})
}

// Update answers PUT /api/v1/integrations/plugins/{type}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	var req UpdateRequest
	dec := json.NewDecoder(r.Body)
	// Unknown fields such as household_id are rejected, not ignored.
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidBody, "request body is not a valid plugin object")
		return
	}
	view, err := h.svc.Save(r.Context(), hc.HouseholdID, chi.URLParam(r, "type"), req)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toResponse(view))
}

// Test answers POST /api/v1/integrations/plugins/{type}/test with the plugin
// and its fresh health. A failed check is a result, not an HTTP error.
func (h *Handler) Test(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	view, err := h.svc.Test(r.Context(), hc.HouseholdID, chi.URLParam(r, "type"))
	if err != nil {
		h.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toResponse(view))
}

func (h *Handler) householdContext(w http.ResponseWriter, r *http.Request) (*household.HouseholdContext, bool) {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		h.log.Error("plugin route without household context; RequireHousehold must run first")
		writeError(w, http.StatusInternalServerError, CodeHouseholdCtx, "household context is missing")
		return nil, false
	}
	return hc, true
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": map[string]any{
			"code": CodeValidation, "message": "the request has invalid fields", "errors": verr.Fields,
		}})
	case errors.Is(err, ErrUnknownType):
		writeError(w, http.StatusNotFound, CodeUnknownType, "plugin type is not available")
	case errors.Is(err, ErrNotConfigured):
		writeError(w, http.StatusNotFound, CodeNotConfigured, "plugin is not configured for this household")
	case errors.Is(err, ErrEncryptionUnavailable):
		writeError(w, http.StatusServiceUnavailable, CodeEncryptionUnavailable,
			"credentials cannot be stored: INTEGRATIONS_ENCRYPTION_KEY is not configured")
	default:
		h.log.Error("plugin request failed", slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, CodeInternal, "the plugin request could not be completed")
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
