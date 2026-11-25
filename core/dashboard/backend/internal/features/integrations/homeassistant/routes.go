package homeassistant

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"alfheim/go-shared/household"
)

// Route paths.
const (
	// BasePath prefixes every Home Assistant route.
	BasePath = "/api/v1/integrations/home-assistant"
	// EventsPath receives signed webhook events (POST, no JWT) and lists the
	// recent events to admins (GET, JWT).
	EventsPath = BasePath + "/events"
)

// AdminMounter mounts the admin routes of the action rules under a prefix;
// *actions.Handler satisfies it.
type AdminMounter interface {
	Mount(r chi.Router, prefix string)
}

// Routes bundles the Home Assistant handlers that main constructs.
type Routes struct {
	Member  *MemberHandler
	Proxy   *MCPProxy
	Secrets *SecretHandler
	Webhook *Webhook
	Rules   AdminMounter
	Log     *slog.Logger
}

// Register mounts the routes. authMw validates the bearer token, householdMw
// confirms the X-Household-ID membership; service principals are not admitted.
// Members read the status and states and use the MCP proxy; OWNER and ADMIN
// manage the webhook and the rules. The webhook itself is authenticated by
// its HMAC signature only.
func (rt Routes) Register(r chi.Router, authMw, householdMw func(http.Handler) http.Handler) {
	r.Post(EventsPath, rt.Webhook.ServeHTTP)
	r.Group(func(r chi.Router) {
		r.Use(authMw, householdMw)
		r.Get(BasePath+"/status", rt.Member.Status)
		r.Get(BasePath+"/states", rt.Member.States)
		r.Post(BasePath+"/mcp", rt.Proxy.Post)
		r.Delete(BasePath+"/mcp", rt.Proxy.Delete)
		r.Get(BasePath+"/mcp", rt.Proxy.MethodNotAllowed)

		r.Group(func(r chi.Router) {
			r.Use(household.RequireHouseholdRole(rt.Log, household.RoleOwner, household.RoleAdmin))
			r.Get(BasePath+"/webhook", rt.Secrets.Info)
			r.Post(BasePath+"/webhook/secret", rt.Secrets.Rotate)
			rt.Rules.Mount(r, BasePath)
		})
	})
}
