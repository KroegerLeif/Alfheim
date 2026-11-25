package actions

import (
	"bytes"
	"encoding/json"
	"regexp"

	"github.com/google/uuid"
)

// EventTypePattern is the allowed shape of an event type, for example
// "washer_finished" or "door.opened".
var EventTypePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.:-]{0,63}$`)

// ValidationError reports a rejected rule field.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Message }

// RuleRequest is the body of POST .../rules. Enabled defaults to true.
type RuleRequest struct {
	EventType string          `json:"event_type"`
	Action    string          `json:"action"`
	Params    json.RawMessage `json:"params"`
	Enabled   *bool           `json:"enabled"`
}

// choreParams are the params of ActionCreateChoreInstance.
type choreParams struct {
	TemplateID string `json:"template_id"`
}

// Validate checks the event type, that the action has an executor and that
// its params are well-formed. Params are decoded strictly.
func (req *RuleRequest) Validate(executors map[string]Executor) error {
	if !EventTypePattern.MatchString(req.EventType) {
		return &ValidationError{Field: "event_type", Message: "use lower case letters, digits and _ . : -"}
	}
	if _, ok := executors[req.Action]; !ok {
		return &ValidationError{Field: "action", Message: "unknown action"}
	}
	if req.Action == ActionCreateChoreInstance {
		p, err := decodeChoreParams(req.Params)
		if err != nil {
			return &ValidationError{Field: "params.template_id", Message: "template_id must be a UUID"}
		}
		// Store the canonical form only.
		req.Params = json.RawMessage(`{"template_id":"` + p.TemplateID + `"}`)
	}
	return nil
}

// decodeChoreParams reads and checks ActionCreateChoreInstance params.
func decodeChoreParams(raw json.RawMessage) (choreParams, error) {
	var p choreParams
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&p); err != nil {
		return choreParams{}, err
	}
	id, err := uuid.Parse(p.TemplateID)
	if err != nil {
		return choreParams{}, err
	}
	return choreParams{TemplateID: id.String()}, nil
}
