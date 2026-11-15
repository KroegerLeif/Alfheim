package apps

// coreHealthURLs are the readiness probes (/readyz, #788) of the Tier-1 app
// backends on gateway-net, the same path their compose healthchecks use. The
// dashboard backend probes them for the live state on the tiles, so a tile
// shows an app as down while its database is unreachable.
var coreHealthURLs = map[string]string{
	"pantry":      "http://pantry-backend:8000/readyz",
	"shopping":    "http://shopping-backend:8000/readyz",
	"maintenance": "http://maintenance-backend:8000/readyz",
	"chores":      "http://chores-backend:8000/readyz",
	"chat":        "http://chat-backend:8080/readyz",
	"workout":     "http://workout-backend:8000/readyz",
	"budget":      "http://budget-backend:8000/readyz",
	"library":     "http://library-backend:8000/readyz",
	"household":   "http://household-backend:8080/readyz",
}

// HealthURL returns the internal health endpoint of the Tier-1 app with the
// given registry ID, and whether it has one.
func HealthURL(id string) (string, bool) {
	url, ok := coreHealthURLs[id]
	return url, ok
}
