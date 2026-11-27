package actions

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/household"
)

// RulesResponse is the body of GET .../rules.
type RulesResponse struct {
	Items []Rule `json:"items"`
}

// EventsResponse is the body of GET .../events: the RecentEvents newest events.
type EventsResponse struct {
	Items []Record `json:"items"`
}

// Handler serves the rules and the event audit list of one plugin type. The
// caller mounts it behind RequireHousehold and the OWNER/ADMIN role check.
type Handler struct {
	svc        *Service
	pluginType string
	log        *slog.Logger
}

// NewHandler returns the handler for pluginType.
func NewHandler(svc *Service, pluginType string, log *slog.Logger) *Handler {
	return &Handler{svc: svc, pluginType: pluginType, log: log}
}

// Mount registers GET/POST {prefix}/rules, DELETE {prefix}/rules/{id} and
// GET {prefix}/events on r.
func (h *Handler) Mount(r chi.Router, prefix string) {
	r.Get(prefix+"/rules", h.listRules)
	r.Post(prefix+"/rules", h.saveRule)
	r.Delete(prefix+"/rules/{id}", h.deleteRule)
	r.Get(prefix+"/events", h.listEvents)
}

func (h *Handler) listRules(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.household(w, r)
	if !ok {
		return
	}
	rules, err := h.svc.Rules(r.Context(), hc.HouseholdID, h.pluginType)
	if err != nil {
		h.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, RulesResponse{Items: rules})
}

func (h *Handler) saveRule(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.household(w, r)
	if !ok {
		return
	}
	var req RuleRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "request body is not a valid rule")
		return
	}
	rule, err := h.svc.SaveRule(r.Context(), hc.HouseholdID, h.pluginType, req)
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": map[string]any{
			"code": "validation_error", "message": "the rule has invalid fields", "errors": []*ValidationError{verr},
		}})
	case err != nil:
		h.internal(w, err)
	default:
		writeJSON(w, http.StatusOK, rule)
	}
}

func (h *Handler) deleteRule(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.household(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err == nil {
		err = h.svc.DeleteRule(r.Context(), hc.HouseholdID, h.pluginType, id)
	} else {
		err = ErrRuleNotFound
	}
	switch {
	case errors.Is(err, ErrRuleNotFound):
		writeError(w, http.StatusNotFound, "rule_not_found", "rule not found")
	case err != nil:
		h.internal(w, err)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request) {
	hc, ok := h.household(w, r)
	if !ok {
		return
	}
	events, err := h.svc.Events(r.Context(), hc.HouseholdID, h.pluginType)
	if err != nil {
		h.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, EventsResponse{Items: events})
}

func (h *Handler) household(w http.ResponseWriter, r *http.Request) (*household.HouseholdContext, bool) {
	hc, err := household.GetHousehold(r.Context())
	if err != nil {
		h.log.Error("rules route without household context; RequireHousehold must run first")
		writeError(w, http.StatusInternalServerError, household.CodeHouseholdContextMissing, "household context is missing")
		return nil, false
	}
	return hc, true
}

func (h *Handler) internal(w http.ResponseWriter, err error) {
	h.log.Error("integration rules request failed", slog.String("error", err.Error()))
	writeError(w, http.StatusInternalServerError, "internal_error", "the request could not be completed")
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"detail": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The status line is already sent; an encoding failure means a gone client.
	_ = json.NewEncoder(w).Encode(body)
}
