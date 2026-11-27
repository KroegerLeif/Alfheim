package servicebindings

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/auth"
	"alfheim/household/internal/shared/httpjson"
)

// Handler serves the public service-binding API. The dashboard calls it with
// the token of a household OWNER or ADMIN when a plugin that triggers actions
// is enabled or disabled:
//
//	POST   /api/v1/households/{id}/service-bindings               create or update
//	GET    /api/v1/households/{id}/service-bindings               list
//	DELETE /api/v1/households/{id}/service-bindings/{principalId} revoke
type Handler struct {
	service *Service
	log     *slog.Logger
}

// NewHandler constructs the service-binding HTTP handler.
func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

// RegisterRoutes mounts the endpoints behind authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/api/v1/households/{id}/service-bindings", h.Create)
		r.Get("/api/v1/households/{id}/service-bindings", h.List)
		r.Delete("/api/v1/households/{id}/service-bindings/{principalId}", h.Revoke)
	})
}

// Create handles POST /api/v1/households/{id}/service-bindings. It answers 201
// with the new binding, or 200 when an existing binding's scopes were replaced.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}
	binding, created, err := h.service.Create(r.Context(), claims.Subject, chi.URLParam(r, "id"), req)
	if err != nil {
		h.writeError(w, err, "failed to save service binding")
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	httpjson.Write(w, status, binding)
}

// List handles GET /api/v1/households/{id}/service-bindings.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}
	bindings, err := h.service.List(r.Context(), claims.Subject, chi.URLParam(r, "id"))
	if err != nil {
		h.writeError(w, err, "failed to list service bindings")
		return
	}
	httpjson.Write(w, http.StatusOK, ListResponse{Bindings: bindings})
}

// Revoke handles DELETE /api/v1/households/{id}/service-bindings/{principalId}
// and answers 204.
func (h *Handler) Revoke(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		httpjson.WriteUnauthorized(w)
		return
	}
	err = h.service.Revoke(r.Context(), claims.Subject, chi.URLParam(r, "id"), chi.URLParam(r, "principalId"))
	if err != nil {
		h.writeError(w, err, "failed to revoke service binding")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) writeError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, ErrForbidden):
		httpjson.WriteError(w, http.StatusForbidden, "forbidden", ErrForbidden.Error())
	case errors.Is(err, ErrNotFound):
		httpjson.WriteError(w, http.StatusNotFound, "not_found", ErrNotFound.Error())
	case errors.Is(err, ErrUnknownPrincipal), errors.Is(err, ErrInvalidScopes):
		httpjson.WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
	case errors.Is(err, ErrPrincipalIsMember):
		httpjson.WriteError(w, http.StatusConflict, "conflict", ErrPrincipalIsMember.Error())
	default:
		h.log.Error(fallback, slog.String("error", err.Error()))
		httpjson.WriteError(w, http.StatusInternalServerError, "internal_server_error", fallback)
	}
}
