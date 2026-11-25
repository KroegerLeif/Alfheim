// Package capabilities reports what the authenticated user may do in the
// installation, so the frontend can hide controls the backend would reject.
package capabilities

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/auth"
)

// Response is the JSON body of GET /api/v1/user/capabilities.
type Response struct {
	// Operator is true when the user holds the Zitadel project role
	// alfheim_operator, which unlocks installation-wide resources such as
	// system logs and metrics.
	Operator bool `json:"operator"`
	// Chat is true when the installation runs the optional chat app
	// (ALFHEIM_ENABLED_APPS), so the ALFI card can offer its settings. It says
	// nothing about whether a model is configured; chat's own API answers that.
	Chat bool `json:"chat"`
}

// Handler serves the capabilities endpoint.
type Handler struct {
	chatEnabled bool
}

// NewHandler creates a capabilities handler. chatEnabled reports whether the
// installation runs the chat app; it is fixed for the process lifetime.
func NewHandler(chatEnabled bool) *Handler {
	return &Handler{chatEnabled: chatEnabled}
}

// RegisterRoutes mounts the capabilities endpoint, guarded by authMiddleware.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Get("/api/v1/user/capabilities", h.Get)
	})
}

// Get handles GET /api/v1/user/capabilities. The answer is derived from the
// validated access token and the installation's app set only; it is a UI
// hint, the guarded endpoints enforce the role themselves.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(Response{Operator: auth.IsOperator(r.Context()), Chat: h.chatEnabled})
}
