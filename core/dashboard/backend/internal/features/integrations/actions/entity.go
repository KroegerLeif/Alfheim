// Package actions turns signed plugin events (for example a Home Assistant
// webhook, #960) into actions on other Alfheim apps. A household's rules map
// an event type to an action; an executor runs the action through the target
// app's public API as the household's service principal (#958, ADR 0010).
// Every event is stored in integration_events for idempotency and audit.
package actions

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ActionCreateChoreInstance creates a one-off chore instance from a template
// (POST /api/v1/chores/instances, #959). Params: {"template_id": "<uuid>"}.
const ActionCreateChoreInstance = "chores.create_instance"

// Status is the outcome of one stored event.
type Status string

// Event statuses.
const (
	// StatusReceived is the transient state while an event is executed.
	StatusReceived Status = "received"
	// StatusExecuted means the action succeeded.
	StatusExecuted Status = "executed"
	// StatusSkipped means the action's app is not installed.
	StatusSkipped Status = "skipped"
	// StatusIgnored means no enabled rule matches the event type.
	StatusIgnored Status = "ignored"
	// StatusFailed means the action was attempted and failed.
	StatusFailed Status = "failed"
)

// Rule maps an event type of one plugin type to an action of a household.
type Rule struct {
	ID          uuid.UUID       `json:"id"`
	HouseholdID uuid.UUID       `json:"-"`
	PluginType  string          `json:"-"`
	EventType   string          `json:"event_type"`
	Action      string          `json:"action"`
	Params      json.RawMessage `json:"params"`
	Enabled     bool            `json:"enabled"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// Event is one inbound, already authenticated plugin event. HouseholdID and
// PluginID come from the plugin row the webhook id names, never the payload.
type Event struct {
	PluginID    uuid.UUID
	HouseholdID uuid.UUID
	PluginType  string
	EventID     string
	EventType   string
	Data        json.RawMessage
}

// Record is a stored event as the audit list shows it.
type Record struct {
	EventID    string    `json:"event_id"`
	EventType  string    `json:"event_type"`
	Status     Status    `json:"status"`
	Action     string    `json:"action"`
	Detail     string    `json:"detail"`
	ReceivedAt time.Time `json:"received_at"`
}

// Outcome is the result of handling one event.
type Outcome struct {
	Status Status
	Detail string
	// Replay is true when the event id was seen before; nothing was executed.
	Replay bool
}

// Execution is one action run for one event.
type Execution struct {
	HouseholdID uuid.UUID
	EventID     string
	Params      json.RawMessage
}

// Result is what an executor reports; Detail is a short English text without
// secrets or upstream bodies.
type Result struct {
	Status Status
	Detail string
}
