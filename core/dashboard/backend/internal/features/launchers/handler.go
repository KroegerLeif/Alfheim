package launchers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/household"
)

// Pagination of GET /api/v1/launchers (ADR 0011).
const (
	DefaultLimit = 100
	MaxLimit     = 100
)

// Error codes of the launcher endpoints, answered as {"detail": {"code", "message"}}.
const (
	CodeValidation   = "validation_error"
	CodeInvalidBody  = "invalid_body"
	CodeNotFound     = "launcher_not_found"
	CodeInternal     = "internal_error"
	CodeHouseholdCtx = household.CodeHouseholdContextMissing
)

// Handler serves the household launcher API.
type Handler struct {
	svc Service
	log *slog.Logger
}

// NewHandler returns the launcher HTTP handler.
func NewHandler(svc Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts the launcher routes. authMw validates the bearer token,
// householdMw confirms the X-Household-ID membership against core/household.
// Every member may list launchers; only OWNER and ADMIN may change them.
func (h *Handler) RegisterRoutes(r chi.Router, authMw, householdMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw, householdMw)
		r.Get("/api/v1/launchers", h.List)

		r.Group(func(r chi.Router) {
			r.Use(household.RequireHouseholdRole(h.log, household.RoleOwner, household.RoleAdmin))
			r.Post("/api/v1/launchers", h.Create)
			r.Put("/api/v1/launchers/{id}", h.Update)
			r.Delete("/api/v1/launchers/{id}", h.Delete)
		})
	})
}

// List answers GET /api/v1/launchers?limit=&offset= with the active household's launchers.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	limit, offset, verr := parsePage(r)
	if verr != nil {
		h.writeErr(w, verr)
		return
	}
	page, err := h.svc.List(r.Context(), hc.HouseholdID, limit, offset)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	items := make([]LauncherResponse, 0, len(page.Items))
	for _, l := range page.Items {
		items = append(items, toResponse(l))
	}
	writeJSON(w, http.StatusOK, ListResponse{Items: items, Total: page.Total, Limit: limit, Offset: offset})
}

// Create answers POST /api/v1/launchers.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	req, ok := decodeRequest(w, r)
	if !ok {
		return
	}
	l, err := h.svc.Create(r.Context(), hc.HouseholdID, hc.Subject, req)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toResponse(l))
}

// Update answers PUT /api/v1/launchers/{id}; the body replaces every field.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	req, ok := decodeRequest(w, r)
	if !ok {
		return
	}
	l, err := h.svc.Update(r.Context(), hc.HouseholdID, id, req)
	if err != nil {
		h.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toResponse(l))
}

// Delete answers DELETE /api/v1/launchers/{id} with 204.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.householdContext(w, r)
	if !ok {
		return
	}
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), hc.HouseholdID, id); err != nil {
		h.writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) householdContext(w http.ResponseWriter, r *http.Request) (*household.HouseholdContext, bool) {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		h.log.Error("launcher route without household context; RequireHousehold must run first")
		writeError(w, http.StatusInternalServerError, CodeHouseholdCtx, "household context is missing")
		return nil, false
	}
	return hc, true
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, CodeNotFound, "launcher not found")
		return uuid.Nil, false
	}
	return id, true
}

func decodeRequest(w http.ResponseWriter, r *http.Request) (LauncherRequest, bool) {
	var req LauncherRequest
	dec := json.NewDecoder(r.Body)
	// Unknown fields such as household_id are rejected, not ignored.
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidBody, "request body is not a valid launcher object")
		return LauncherRequest{}, false
	}
	return req, true
}

func parsePage(r *http.Request) (limit, offset int, err error) {
	limit, offset = DefaultLimit, 0
	var fields []FieldError
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, convErr := strconv.Atoi(raw)
		if convErr != nil || n < 1 || n > MaxLimit {
			fields = append(fields, FieldError{Field: "limit", Message: "limit must be between 1 and 100"})
		} else {
			limit = n
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		n, convErr := strconv.Atoi(raw)
		if convErr != nil || n < 0 {
			fields = append(fields, FieldError{Field: "offset", Message: "offset must not be negative"})
		} else {
			offset = n
		}
	}
	if len(fields) > 0 {
		return 0, 0, &ValidationError{Fields: fields}
	}
	return limit, offset, nil
}

func (h *Handler) writeErr(w http.ResponseWriter, err error) {
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": map[string]any{
			"code": CodeValidation, "message": "the request has invalid fields", "errors": verr.Fields,
		}})
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, CodeNotFound, "launcher not found")
	default:
		h.log.Error("launcher request failed", slog.String("error", err.Error()))
		writeError(w, http.StatusInternalServerError, CodeInternal, "the launcher request could not be completed")
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
