// Package apps owns the catalog of Alfheim apps and optional modules, and the
// rules for which of them may be switched on and off (ADR 0007): the Lean Core
// always runs, every app under apps/ and the telemetry stack are optional.
package apps

// Tier says whether an app belongs to the always-on Lean Core.
type Tier string

// The two tiers of ADR 0007.
const (
	// TierCore apps always run and cannot be disabled.
	TierCore Tier = "core"
	// TierOptional apps run only when they are in the enabled set.
	TierOptional Tier = "optional"
)

// App is one entry of the catalog.
type App struct {
	// Name is the app id, also its compose profile for an optional app.
	Name string
	// Title is the human readable name.
	Title string
	// Tier says whether the app can be disabled.
	Tier Tier
	// Requires lists the apps that must be enabled while this one is.
	Requires []string
	// Services are the compose services the app owns in compose.prod.yaml.
	Services []string
	// Containers are the container names of Services, waited on after a
	// start. Empty means they equal the service names.
	Containers []string
}

// ContainerNames returns the containers to wait on after starting the app.
func (a App) ContainerNames() []string {
	if len(a.Containers) > 0 {
		return a.Containers
	}
	return a.Services
}

// Optional reports whether the app can be switched off.
func (a App) Optional() bool { return a.Tier == TierOptional }

// catalog lists every app in display order: the Lean Core first, then the
// optional modules. It mirrors compose.prod.yaml and ADR 0007.
var catalog = []App{
	{Name: "dashboard", Title: "Dashboard", Tier: TierCore,
		Services: []string{"dashboard-backend", "dashboard-frontend"}},
	{Name: "household", Title: "Household & roles", Tier: TierCore,
		Services: []string{"household-backend", "household-frontend"}},
	{Name: "pantry", Title: "Pantry", Tier: TierOptional,
		Services: []string{"pantry-backend", "pantry-frontend"}},
	{Name: "shopping", Title: "Shopping lists", Tier: TierOptional, Requires: []string{"pantry"},
		Services: []string{"shopping-backend", "shopping-frontend"}},
	{Name: "budget", Title: "Budget", Tier: TierOptional,
		Services: []string{"budget-backend", "budget-frontend"}},
	{Name: "chores", Title: "Chores", Tier: TierOptional,
		Services: []string{"chores-backend", "chores-frontend"}},
	{Name: "library", Title: "Library", Tier: TierOptional,
		Services: []string{"library-backend", "library-frontend"}},
	{Name: "workout", Title: "Workout", Tier: TierOptional,
		Services: []string{"workout-backend", "workout-frontend"}},
	{Name: "maintenance", Title: "Maintenance", Tier: TierOptional,
		Services: []string{"maintenance-backend", "maintenance-frontend"}},
	{Name: "chat", Title: "Chat assistant", Tier: TierOptional,
		Services: []string{"chat-backend", "chat-frontend"}},
	{Name: Telemetry, Title: "Telemetry (metrics, logs, Grafana)", Tier: TierOptional,
		Services: []string{
			"victoriametrics", "node-exporter", "victorialogs", "otel-collector",
			"docker-socket-proxy", "vector", "grafana",
		},
		Containers: []string{
			"victoriametrics", "node-exporter", "victorialogs", "otel-collector",
			"docker-socket-proxy", "vector-shipper", "alfheim_grafana",
		}},
}

// Telemetry is the name of the optional observability module. Toggling it
// also switches OTEL_ENABLED, which the services read to export traces.
const Telemetry = "telemetry"

// Catalog returns a copy of every app in display order.
func Catalog() []App {
	out := make([]App, len(catalog))
	copy(out, catalog)
	return out
}

// Lookup returns the catalog entry for name.
func Lookup(name string) (App, bool) {
	for _, a := range catalog {
		if a.Name == name {
			return a, true
		}
	}
	return App{}, false
}
