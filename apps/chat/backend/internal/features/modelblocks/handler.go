package modelblocks

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/chat/internal/shared/middleware"
)

// Handler manages model block HTTP endpoints.
type Handler struct {
	service Service
}

// NewHandler creates a model block HTTP handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts model block endpoints on a chi Router, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/chat/model-blocks", h.List)
		r.Get("/api/v1/chat/model-blocks/{id}", h.Get)
		r.Post("/api/v1/chat/model-blocks", h.Create)
		r.Patch("/api/v1/chat/model-blocks/{id}", h.Update)
		r.Delete("/api/v1/chat/model-blocks/{id}", h.Delete)
		r.Post("/api/v1/chat/model-blocks/{id}/health-check", h.TriggerHealthCheck)
		r.Post("/api/v1/chat/models/discover", h.Discover)
	})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	blocks, err := h.service.List(r.Context(), claims.Subject, claims.HouseholdID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_server_error", "failed to list model blocks")
		return
	}

	writeJSON(w, http.StatusOK, blocks)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	block, err := h.service.Get(r.Context(), claims.Subject, claims.HouseholdID, id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, block)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid json request payload")
		return
	}

	created, err := h.service.Create(r.Context(), claims.Subject, claims.HouseholdID, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
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

	updated, err := h.service.Update(r.Context(), claims.Subject, claims.HouseholdID, id, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
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

func (h *Handler) TriggerHealthCheck(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing authenticated user context")
		return
	}

	id := chi.URLParam(r, "id")

	result, err := h.service.TriggerHealthCheck(r.Context(), claims.Subject, claims.HouseholdID, id)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) Discover(w http.ResponseWriter, r *http.Request) {
	claims, err := middleware.GetUserClaims(r.Context())
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
		writeError(w, http.StatusBadGateway, "discovery_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// writeServiceError maps domain errors to their corresponding HTTP status codes.
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "model block not found")
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, ErrMissingHouseholdID), errors.Is(err, ErrInvalidVisibility), errors.Is(err, ErrInvalidProviderType):
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
