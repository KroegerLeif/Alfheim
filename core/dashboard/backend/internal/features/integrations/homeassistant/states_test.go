package homeassistant

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
)

func TestStates_PinnedAndCached(t *testing.T) {
	d := newHADouble(t)
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{
		hhA: instance(hhA, d.srv.URL, `{"pinned_entities":["sensor.temp","sensor.gone"]}`),
	}}
	s := NewStates(access, testClient())
	now := time.Unix(1_800_000_000, 0)
	s.now = func() time.Time { return now }

	got, err := s.Pinned(context.Background(), hhA)
	if err != nil || len(got) != 2 {
		t.Fatalf("pinned: %+v %v", got, err)
	}
	if got[0].State != "21.5" || got[0].FriendlyName != "Living room" || got[0].Unit != "°C" || !got[0].Found || got[0].LastChanged == nil {
		t.Errorf("state not mapped: %+v", got[0])
	}
	if got[1].Found || got[1].State != "unknown" {
		t.Errorf("a missing entity is reported, not an error: %+v", got[1])
	}

	if _, err := s.Pinned(context.Background(), hhA); err != nil || d.count("GET /api/states/sensor.temp") != 1 {
		t.Fatalf("second read within the TTL must be cached: %v, calls %d", err, d.count("GET /api/states/sensor.temp"))
	}
	now = now.Add(StatesTTL)
	if _, err := s.Pinned(context.Background(), hhA); err != nil || d.count("GET /api/states/sensor.temp") != 2 {
		t.Fatalf("an expired entry must be refetched, calls %d", d.count("GET /api/states/sensor.temp"))
	}
	inst := access.inst[hhA]
	inst.Config = cfg(d.srv.URL, `{"pinned_entities":["sensor.temp"]}`)
	access.inst[hhA] = inst
	if got, _ := s.Pinned(context.Background(), hhA); len(got) != 1 {
		t.Fatalf("a changed configuration must bypass the cache: %+v", got)
	}
}

func TestStates_Errors(t *testing.T) {
	d := newHADouble(t)
	bad := instance(hhA, d.srv.URL, `{"pinned_entities":["sensor.temp"]}`)
	bad.Credentials = plugins.Credentials{CredentialToken: "wrong"}
	for name, tc := range map[string]struct {
		access *fakeAccess
		client *http.Client
		want   error
	}{
		"not configured": {&fakeAccess{}, testClient(), plugins.ErrNotConfigured},
		"auth":           {&fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: bad}}, testClient(), ErrAuthRejected},
		"upstream": {&fakeAccess{inst: map[uuid.UUID]plugins.Instance{
			hhA: instance(hhA, d.srv.URL, `{"pinned_entities":["sensor.broken"]}`)}}, testClient(), ErrUpstream},
		"blocked": {&fakeAccess{inst: map[uuid.UUID]plugins.Instance{
			hhA: instance(hhA, d.srv.URL, `{"pinned_entities":["sensor.temp"]}`)}}, blockedClient(), plugins.ErrHostNotAllowed},
		"bad settings": {&fakeAccess{inst: map[uuid.UUID]plugins.Instance{
			hhA: instance(hhA, d.srv.URL, `{"oops":1}`)}}, testClient(), ErrUpstream},
	} {
		if _, err := NewStates(tc.access, tc.client).Pinned(context.Background(), hhA); !errors.Is(err, tc.want) {
			t.Errorf("%s: want %v, got %v", name, tc.want, err)
		}
	}
}

func TestStates_StoreEvictsExpired(t *testing.T) {
	s := NewStates(&fakeAccess{}, testClient())
	now := time.Unix(1_800_000_000, 0)
	s.now = func() time.Time { return now }
	s.store(hhA, statesEntry{key: "a", expires: now.Add(time.Second)})
	now = now.Add(2 * time.Second)
	s.store(hhB, statesEntry{key: "b", expires: now.Add(time.Second)})
	if _, ok := s.cache[hhA]; ok || len(s.cache) != 1 {
		t.Fatalf("expired entries must be evicted: %+v", s.cache)
	}
}
