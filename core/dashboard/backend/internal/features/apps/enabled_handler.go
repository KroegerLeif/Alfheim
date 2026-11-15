package apps

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// EnabledAppsResponse is the body of GET /api/v1/apps/enabled.
type EnabledAppsResponse struct {
	// Apps holds the registry IDs of the Tier-1 apps this installation runs,
	// in registry order. It reflects ALFHEIM_ENABLED_APPS only: a user's hidden
	// tiles and the live health of an app do not change it.
	Apps []string `json:"apps"`
}

// EnabledAppsHandler tells frontends which optional apps are installed, so
// they can leave out entry points into an app that is not there (for example
// the chat widget, #917) without probing that app's backend.
type EnabledAppsHandler struct {
	ids []string
}

// NewEnabledAppsHandler builds the handler from the enabled Tier-1 registry
// entries (see EnabledCoreApps). The list is fixed for the process lifetime.
func NewEnabledAppsHandler(coreApps []AppItem) *EnabledAppsHandler {
	ids := make([]string, 0, len(coreApps))
	for _, app := range coreApps {
		ids = append(ids, app.ID)
	}
	return &EnabledAppsHandler{ids: ids}
}

// RegisterRoutes mounts GET /api/v1/apps/enabled behind authMiddleware.
func (h *EnabledAppsHandler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.With(authMiddleware).Get("/api/v1/apps/enabled", h.Get)
}

// Get serves the enabled Tier-1 app IDs.
func (h *EnabledAppsHandler) Get(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(EnabledAppsResponse{Apps: h.ids})
}
