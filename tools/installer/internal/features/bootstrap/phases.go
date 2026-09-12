// Package bootstrap orchestrates the staged Docker Compose lifecycle of an
// Alfheim installation.
package bootstrap

import "time"

// HealthTarget is a container the orchestrator waits on before continuing.
type HealthTarget struct {
	// Container is the container_name declared in compose.prod.yaml.
	Container string
	// Label is the human readable name shown in the TUI.
	Label string
	// Timeout bounds the wait for this container.
	Timeout time.Duration
}

// Phase is one stage of the staged boot.
type Phase struct {
	Name string
	// Services are the Compose services to start. An empty slice starts the
	// whole stack, which is how the second phase brings up everything else.
	Services []string
	WaitFor  []HealthTarget
}

// PhaseEdgeAuth starts the database, the ingress gateway and the identity
// provider. It is deliberately separate from the application stack: Zitadel
// has to be reachable and its admin account created before any service can
// verify a token, which is the chicken-and-egg problem this split resolves.
var PhaseEdgeAuth = Phase{
	Name:     "Edge & Identity",
	Services: []string{"postgres-core", "caddy", "zitadel"},
	WaitFor: []HealthTarget{
		{Container: "alfheim_postgres_core", Label: "PostgreSQL core", Timeout: 120 * time.Second},
		{Container: "alfheim_caddy", Label: "Caddy ingress gateway", Timeout: 90 * time.Second},
		// Zitadel runs its first-instance migration on a cold start, which
		// is by far the slowest step of the whole install.
		{Container: "alfheim_zitadel", Label: "Zitadel identity provider", Timeout: 300 * time.Second},
	},
}

// PhaseCoreStack starts every remaining service.
var PhaseCoreStack = Phase{
	Name:     "Core & Application Stack",
	Services: nil,
	WaitFor: []HealthTarget{
		{Container: "dashboard-backend", Label: "Dashboard control plane", Timeout: 240 * time.Second},
		{Container: "dashboard-frontend", Label: "Dashboard frontend", Timeout: 180 * time.Second},
	},
}
