// Package capabilities reports what the authenticated user may do in the
// installation, so the frontend can hide controls the backend would reject.
package capabilities

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/dashboard/internal/shared/middleware"
)

// Response is the JSON body of GET /api/v1/user/capabilities.
type Response struct {
	// Operator is true when the user holds the Zitadel project role
	// alfheim_operator, which unlocks installation-wide resources such as
	// system logs and metrics.
	Operator bool `json:"operator"`
}

// Handler serves the capabilities endpoint.
type Handler struct{}

// NewHandler creates a capabilities handler.
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes mounts the capabilities endpoint, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/user/capabilities", h.Get)
	})
}

// Get handles GET /api/v1/user/capabilities. The answer is derived from the
// validated access token only; it is a UI hint, the guarded endpoints enforce
// the role themselves.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(Response{Operator: middleware.IsOperator(r.Context())})
}
