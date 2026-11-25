package homeassistant

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/netguard"
)

// StatesTTL is how long the pinned entity states of a household are reused.
const StatesTTL = 10 * time.Second

// ErrUpstream means Home Assistant could not be reached or answered badly.
var ErrUpstream = errors.New("home assistant request failed")

// ErrAuthRejected means Home Assistant rejected the stored token.
var ErrAuthRejected = errors.New("home assistant rejected the access token")

// PluginAccess is the subset of *plugins.Service this package uses.
type PluginAccess interface {
	Instance(ctx context.Context, householdID uuid.UUID, pluginType string) (plugins.Instance, error)
	EnabledInstance(ctx context.Context, householdID uuid.UUID, pluginType string) (plugins.Instance, error)
	IsEnabled(ctx context.Context, householdID uuid.UUID, pluginType string) (bool, error)
}

// EntityState is one pinned entity as the dashboard shows it.
type EntityState struct {
	EntityID     string     `json:"entity_id"`
	State        string     `json:"state"`
	FriendlyName string     `json:"friendly_name"`
	Unit         string     `json:"unit"`
	LastChanged  *time.Time `json:"last_changed"`
	// Found is false when Home Assistant does not know the entity.
	Found bool `json:"found"`
}

type haState struct {
	EntityID    string     `json:"entity_id"`
	State       string     `json:"state"`
	LastChanged *time.Time `json:"last_changed"`
	Attributes  struct {
		FriendlyName string `json:"friendly_name"`
		Unit         string `json:"unit_of_measurement"`
	} `json:"attributes"`
}

type statesEntry struct {
	key     string
	states  []EntityState
	expires time.Time
}

// States reads the pinned entities of a household's Home Assistant and keeps
// each household's answer for StatesTTL. It is safe for concurrent use.
type States struct {
	access PluginAccess
	client *http.Client
	now    func() time.Time

	mu    sync.Mutex
	cache map[uuid.UUID]statesEntry
}

// NewStates returns the states reader; client is the netguard client.
func NewStates(access PluginAccess, client *http.Client) *States {
	return &States{access: access, client: client, now: time.Now, cache: map[uuid.UUID]statesEntry{}}
}

// Pinned returns the states of the household's pinned entities. It fails with
// the plugins sentinels (ErrNotConfigured, ErrDisabled, ErrHostNotAllowed),
// ErrAuthRejected or ErrUpstream.
func (s *States) Pinned(ctx context.Context, householdID uuid.UUID) ([]EntityState, error) {
	inst, err := s.access.EnabledInstance(ctx, householdID, Type)
	if err != nil {
		return nil, err
	}
	settings, err := decodeSettings(inst.Config)
	if err != nil {
		return nil, errors.Join(ErrUpstream, err)
	}
	// The key changes with the configuration, so a saved change is visible at once.
	key := inst.Config.BaseURL + "|" + strings.Join(settings.PinnedEntities, ",")
	if cached, ok := s.lookup(householdID, key); ok {
		return cached, nil
	}
	out := make([]EntityState, 0, len(settings.PinnedEntities))
	for _, id := range settings.PinnedEntities {
		st, err := s.fetch(ctx, inst, id)
		if err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	s.store(householdID, statesEntry{key: key, states: out, expires: s.now().Add(StatesTTL)})
	return out, nil
}

func (s *States) fetch(ctx context.Context, inst plugins.Instance, entityID string) (EntityState, error) {
	var raw haState
	status, err := getJSON(ctx, s.client, inst.Config.BaseURL, "/api/states/"+url.PathEscape(entityID), inst.Credentials[CredentialToken], &raw)
	switch {
	case status == http.StatusNotFound:
		return EntityState{EntityID: entityID, State: "unknown"}, nil
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return EntityState{}, ErrAuthRejected
	case errors.Is(err, netguard.ErrBlocked):
		return EntityState{}, plugins.ErrHostNotAllowed
	case err != nil:
		return EntityState{}, ErrUpstream
	}
	return EntityState{
		EntityID:     entityID,
		State:        raw.State,
		FriendlyName: raw.Attributes.FriendlyName,
		Unit:         raw.Attributes.Unit,
		LastChanged:  raw.LastChanged,
		Found:        true,
	}, nil
}

func (s *States) lookup(householdID uuid.UUID, key string) ([]EntityState, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.cache[householdID]
	if !ok || e.key != key || !s.now().Before(e.expires) {
		return nil, false
	}
	return e.states, true
}

func (s *States) store(householdID uuid.UUID, e statesEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for hh, old := range s.cache {
		if !now.Before(old.expires) {
			delete(s.cache, hh)
		}
	}
	s.cache[householdID] = e
}
