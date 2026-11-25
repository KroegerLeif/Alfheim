package modelblocks

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/auth"
	"alfheim/go-shared/household"
)

// Handler manages model block HTTP endpoints.
type Handler struct {
	service Service
	log     *slog.Logger
}

// NewHandler creates a model block HTTP handler.
func NewHandler(service Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

// RegisterRoutes mounts model block endpoints on a chi Router, guarded by
// authMiddleware, which also confirms the household (household.RequireHousehold).
// Only OWNER and ADMIN may write the household default shared block.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/chat/model-blocks/household-default", h.GetHouseholdDefault)
		r.With(household.RequireHouseholdRole(h.log, household.RoleOwner, household.RoleAdmin)).
			Put("/api/v1/chat/model-blocks/household-default", h.PutHouseholdDefault)
		r.Get("/api/v1/chat/model-blocks", h.List)
		r.Get("/api/v1/chat/model-blocks/{id}", h.Get)
		r.Post("/api/v1/chat/model-blocks", h.Create)
		r.Patch("/api/v1/chat/model-blocks/{id}", h.Update)
		r.Delete("/api/v1/chat/model-blocks/{id}", h.Delete)
		r.Post("/api/v1/chat/model-blocks/{id}/health-check", h.TriggerHealthCheck)
		r.Post("/api/v1/chat/models/discover", h.Discover)
	})
}

// List returns the model blocks visible to the caller.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	blocks, err := h.service.List(r.Context(), claims.Subject, householdOf(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to list model blocks")
		return
	}

	writeJSON(w, http.StatusOK, blocks)
}

// Get returns one model block the caller may see.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	block, err := h.service.Get(r.Context(), claims.Subject, householdOf(r), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, block)
}

// Create stores a new model block owned by the caller.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	created, err := h.service.Create(r.Context(), claims.Subject, householdOf(r), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// Update changes a model block; only its owner may do so.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	updated, err := h.service.Update(r.Context(), claims.Subject, householdOf(r), id, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// Delete removes a model block; only its owner may do so.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	if err := h.service.Delete(r.Context(), claims.Subject, id); err != nil {
		writeServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TriggerHealthCheck probes the provider of a model block and records the result.
func (h *Handler) TriggerHealthCheck(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	result, err := h.service.TriggerHealthCheck(r.Context(), claims.Subject, householdOf(r), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}
