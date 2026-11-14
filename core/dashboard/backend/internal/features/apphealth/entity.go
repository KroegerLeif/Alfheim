// Package apphealth probes the health endpoints of the Tier-1 app backends
// for the dashboard tiles. The browser never calls the app APIs for this:
// the dashboard backend probes each app at most once per cache window and
// serves the cached snapshot to every open dashboard.
package apphealth

import "time"

// State is the live health of one app.
type State string

// The states a tile can show.
const (
	// StateOnline means the health endpoint answered 2xx.
	StateOnline State = "online"
	// StateDegraded means the backend answered, but not 2xx (for example its
	// database is unreachable).
	StateDegraded State = "degraded"
	// StateOffline means the backend did not answer within the timeout.
	StateOffline State = "offline"
)

// Target is one app to probe.
type Target struct {
	// ID is the registry ID of the app, as shown on the tile.
	ID string
	// URL is the app backend's health endpoint on the internal network.
	URL string
}

// Snapshot is the result of one probe round.
type Snapshot struct {
	// Apps maps each app ID to its state.
	Apps map[string]State `json:"apps"`
	// CheckedAt is when the round finished.
	CheckedAt time.Time `json:"checked_at"`
}
