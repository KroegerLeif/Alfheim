package homeassistant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/integrations/actions"
)

// eventIDPattern matches the chores Idempotency-Key rule: 1-200 printable
// ASCII characters without spaces.
var eventIDPattern = regexp.MustCompile(`^[\x21-\x7e]{1,200}$`)

// EventHandler is the subset of *actions.Service the webhook uses.
type EventHandler interface {
	Handle(ctx context.Context, ev actions.Event) (actions.Outcome, error)
}

// EventPayload is the body Home Assistant posts.
type EventPayload struct {
	EventID   string          `json:"event_id"`
	EventType string          `json:"event_type"`
	Data      json.RawMessage `json:"data"`
}

// EventResponse is the webhook answer.
type EventResponse struct {
	Status actions.Status `json:"status"`
	Replay bool           `json:"replay"`
}

// Webhook serves POST /api/v1/integrations/home-assistant/events. It needs no
// JWT: the HMAC signature with the plugin's secret authenticates the caller,
// and the household is the plugin row's, never the payload's.
type Webhook struct {
	access  PluginAccess
	store   SecretStore
	sealer  Sealer
	handler EventHandler
	now     func() time.Time
	log     *slog.Logger
}

// NewWebhook returns the webhook handler.
func NewWebhook(access PluginAccess, store SecretStore, sealer Sealer, handler EventHandler, log *slog.Logger) *Webhook {
	return &Webhook{access: access, store: store, sealer: sealer, handler: handler, now: time.Now, log: log}
}

// ServeHTTP verifies, deduplicates and dispatches one event.
func (h *Webhook) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxWebhookBody))
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "webhook_body_too_large", "the body exceeds 16 KiB")
		return
	}
	pluginID, err := uuid.Parse(r.Header.Get(HeaderWebhookID))
	if err != nil {
		writeError(w, http.StatusNotFound, "webhook_not_found", "unknown webhook")
		return
	}
	stored, err := h.store.Get(r.Context(), pluginID)
	if errors.Is(err, ErrNoWebhook) {
		writeError(w, http.StatusNotFound, "webhook_not_found", "unknown webhook")
		return
	}
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	if !h.authentic(r, stored, body) {
		h.log.Warn("home assistant webhook rejected: bad signature or timestamp",
			slog.String("household_id", stored.HouseholdID.String()))
		writeError(w, http.StatusUnauthorized, "webhook_signature_invalid", "the signature or timestamp is not valid")
		return
	}
	enabled, err := h.access.IsEnabled(r.Context(), stored.HouseholdID, Type)
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	if !enabled {
		writeError(w, http.StatusNotFound, "webhook_not_found", "unknown webhook")
		return
	}
	payload, ok := decodePayload(body)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "webhook_payload_invalid",
			"the body must be {event_id, event_type, data} with a valid event_id and event_type")
		return
	}
	out, err := h.handler.Handle(r.Context(), actions.Event{
		PluginID: pluginID, HouseholdID: stored.HouseholdID, PluginType: Type,
		EventID: payload.EventID, EventType: payload.EventType, Data: payload.Data,
	})
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	writeJSON(w, outcomeStatus(out), EventResponse{Status: out.Status, Replay: out.Replay})
}

// authentic checks the timestamp window and the signature. A secret that
// cannot be opened authenticates nothing.
func (h *Webhook) authentic(r *http.Request, stored SealedSecret, body []byte) bool {
	ts := r.Header.Get(HeaderTimestamp)
	if !withinWindow(ts, h.now()) {
		return false
	}
	creds, err := h.sealer.Open(stored.Sealed, stored.KeyID)
	if err != nil || creds[credentialSecret] == "" {
		return false
	}
	return validSignature(creds[credentialSecret], ts, body, r.Header.Get(HeaderSignature))
}

// decodePayload reads the body strictly and checks event_id and event_type.
func decodePayload(body []byte) (EventPayload, bool) {
	var p EventPayload
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&p); err != nil {
		return EventPayload{}, false
	}
	if !eventIDPattern.MatchString(p.EventID) || !actions.EventTypePattern.MatchString(p.EventType) {
		return EventPayload{}, false
	}
	return p, true
}

// outcomeStatus maps an outcome to the HTTP status: a replay is 200, an event
// that ran nothing (skipped, ignored) 202, a failed action 502.
func outcomeStatus(out actions.Outcome) int {
	switch {
	case out.Replay, out.Status == actions.StatusExecuted:
		return http.StatusOK
	case out.Status == actions.StatusFailed:
		return http.StatusBadGateway
	default:
		return http.StatusAccepted
	}
}
