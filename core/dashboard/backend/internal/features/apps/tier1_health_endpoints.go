package apps

// coreHealthURLs are the health endpoints of the Tier-1 app backends on
// gateway-net, the same paths their compose healthchecks use. The dashboard
// backend probes them for the live state on the tiles.
var coreHealthURLs = map[string]string{
	"pantry":      "http://pantry-backend:8000/api/v1/health",
	"shopping":    "http://shopping-backend:8000/health",
	"maintenance": "http://maintenance-backend:8000/api/v1/health",
	"chores":      "http://chores-backend:8000/api/v1/health",
	"chat":        "http://chat-backend:8080/api/v1/chat/health",
	"workout":     "http://workout-backend:8000/api/v1/health",
	"budget":      "http://budget-backend:8000/healthz",
	"library":     "http://library-backend:8000/health",
	"household":   "http://household-backend:8080/healthz",
}

// HealthURL returns the internal health endpoint of the Tier-1 app with the
// given registry ID, and whether it has one.
func HealthURL(id string) (string, bool) {
	url, ok := coreHealthURLs[id]
	return url, ok
}
