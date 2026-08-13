package telemetry

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Handler manages HTTP endpoints for system health telemetry.
type Handler struct {
	service Service
}

// NewHandler initializes a telemetry handler instance.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers telemetry endpoints on a chi router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/telemetry", h.GetMetrics)
		r.Get("/api/v1/telemetry/metrics", h.GetMetrics)
		r.Get("/api/v1/telemetry/logs", h.GetLogs)
	})
}

// GetMetrics handles GET /api/v1/telemetry/metrics.
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.service.GetMetrics(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "internal_server_error",
			"message": "failed to retrieve system metrics",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(metrics)
}

// GetLogs handles GET /api/v1/telemetry/logs.
func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := h.service.GetLogs(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "internal_server_error",
			"message": "failed to retrieve system logs",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(logs)
}
