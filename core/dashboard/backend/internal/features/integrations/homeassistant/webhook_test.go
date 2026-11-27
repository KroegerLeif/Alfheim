package homeassistant

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/integrations/actions"
	"alfheim/dashboard/internal/features/plugins"
)

const webhookSecret = "whsec-test-secret"

var testCipher = func() *plugins.Cipher {
	c, err := plugins.NewCipher([]byte("0123456789abcdef0123456789abcdef"), "v1")
	if err != nil {
		panic(err)
	}
	return c
}()

// memSecrets is the SecretStore double.
type memSecrets struct {
	rows map[uuid.UUID]SealedSecret
	err  error
}

func (m *memSecrets) Put(_ context.Context, pluginID, hh uuid.UUID, sealed []byte, keyID string) error {
	if m.err != nil {
		return m.err
	}
	m.rows[pluginID] = SealedSecret{HouseholdID: hh, Sealed: sealed, KeyID: keyID}
	return nil
}

func (m *memSecrets) Get(_ context.Context, pluginID uuid.UUID) (SealedSecret, error) {
	if m.err != nil {
		return SealedSecret{}, m.err
	}
	s, ok := m.rows[pluginID]
	if !ok {
		return SealedSecret{}, ErrNoWebhook
	}
	return s, nil
}

// memEvents is an in-memory actions.Repository with one rule per test.
type memEvents struct {
	mu     sync.Mutex
	rule   *actions.Rule
	events map[string]actions.Status
}

func (m *memEvents) ListRules(context.Context, uuid.UUID, string) ([]actions.Rule, error) {
	return nil, nil
}
func (m *memEvents) SaveRule(context.Context, *actions.Rule) error                  { return nil }
func (m *memEvents) DeleteRule(context.Context, uuid.UUID, string, uuid.UUID) error { return nil }
func (m *memEvents) RecentEvents(context.Context, uuid.UUID, string) ([]actions.Record, error) {
	return nil, nil
}

func (m *memEvents) FindRule(_ context.Context, hh uuid.UUID, _, eventType string) (actions.Rule, error) {
	if m.rule == nil || m.rule.HouseholdID != hh || m.rule.EventType != eventType {
		return actions.Rule{}, actions.ErrRuleNotFound
	}
	return *m.rule, nil
}

func (m *memEvents) InsertEvent(_ context.Context, ev actions.Event) (bool, actions.Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := ev.PluginID.String() + "|" + ev.EventID
	if st, ok := m.events[key]; ok {
		return false, st, nil
	}
	m.events[key] = actions.StatusReceived
	return true, actions.StatusReceived, nil
}

func (m *memEvents) FinishEvent(_ context.Context, ev actions.Event, _ string, res actions.Result) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events[ev.PluginID.String()+"|"+ev.EventID] = res.Status
	return nil
}

type webhookFixture struct {
	hook     *Webhook
	access   *fakeAccess
	secrets  *memSecrets
	pluginID uuid.UUID
	chores   *httptest.Server
	keys     []string
	now      time.Time
}

func newWebhookFixture(t *testing.T, choresInstalled bool) *webhookFixture {
	t.Helper()
	f := &webhookFixture{now: time.Unix(1_800_000_000, 0)}
	f.chores = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/chores/instances" || r.Header.Get("X-Household-ID") != hhA.String() ||
			r.Header.Get("Authorization") != "Bearer principal-token" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		f.keys = append(f.keys, r.Header.Get("Idempotency-Key"))
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(f.chores.Close)
	inst := instance(hhA, "http://ha.lan", `{}`)
	f.pluginID = inst.ID
	f.access = &fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: inst}}
	sealed, keyID, err := testCipher.Seal(plugins.Credentials{credentialSecret: webhookSecret})
	if err != nil {
		t.Fatal(err)
	}
	f.secrets = &memSecrets{rows: map[uuid.UUID]SealedSecret{inst.ID: {HouseholdID: hhA, Sealed: sealed, KeyID: keyID}}}
	rule := &actions.Rule{HouseholdID: hhA, EventType: "washer_finished", Action: actions.ActionCreateChoreInstance,
		Params: []byte(`{"template_id":"33333333-3333-4333-8333-333333333333"}`), Enabled: true}
	exec := actions.NewChoresExecutor(f.chores.URL, choresInstalled, staticToken("principal-token"), f.chores.Client())
	svc := actions.NewService(&memEvents{rule: rule, events: map[string]actions.Status{}},
		map[string]actions.Executor{actions.ActionCreateChoreInstance: exec}, discard())
	f.hook = NewWebhook(f.access, f.secrets, testCipher, svc, discard())
	f.hook.now = func() time.Time { return f.now }
	return f
}

type staticToken string

func (s staticToken) Token(context.Context) (string, error) { return string(s), nil }

func discard() *slog.Logger { l, _ := bufLog(); return l }

// send posts body signed with secret at ts.
func (f *webhookFixture) send(body, secret string, ts time.Time, id string) *httptest.ResponseRecorder {
	stamp := strconv.FormatInt(ts.Unix(), 10)
	req := httptest.NewRequest(http.MethodPost, EventsPath, strings.NewReader(body))
	req.Header.Set(HeaderWebhookID, id)
	req.Header.Set(HeaderTimestamp, stamp)
	req.Header.Set(HeaderSignature, Sign(secret, stamp, []byte(body)))
	rec := httptest.NewRecorder()
	f.hook.ServeHTTP(rec, req)
	return rec
}

const washerEvent = `{"event_id":"evt-0001","event_type":"washer_finished","data":{"program":"cotton"}}`

func TestWebhook_HappyPathAndReplay(t *testing.T) {
	f := newWebhookFixture(t, true)
	rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String())
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"executed"`) {
		t.Fatalf("happy path: %d %s", rec.Code, rec.Body.String())
	}
	if len(f.keys) != 1 || f.keys[0] != "evt-0001" {
		t.Fatalf("chores must get Idempotency-Key = event_id, got %v", f.keys)
	}
	rec = f.send(washerEvent, webhookSecret, f.now.Add(time.Minute), f.pluginID.String())
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"replay":true`) || len(f.keys) != 1 {
		t.Fatalf("a replayed event_id answers 200 without re-executing: %d %s %v", rec.Code, rec.Body.String(), f.keys)
	}
	rec = f.send(`{"event_id":"evt-2","event_type":"door_opened"}`, webhookSecret, f.now, f.pluginID.String())
	if rec.Code != http.StatusAccepted || !strings.Contains(rec.Body.String(), `"ignored"`) {
		t.Fatalf("an event without a rule: %d %s", rec.Code, rec.Body.String())
	}
}

func TestWebhook_ChoresNotInstalledIsSkipped(t *testing.T) {
	f := newWebhookFixture(t, false)
	rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String())
	if rec.Code != http.StatusAccepted || !strings.Contains(rec.Body.String(), `"skipped"`) || len(f.keys) != 0 {
		t.Fatalf("chores disabled: %d %s", rec.Code, rec.Body.String())
	}
}

func TestWebhook_Rejections(t *testing.T) {
	f := newWebhookFixture(t, true)
	id := f.pluginID.String()
	cases := map[string]struct {
		rec  func() *httptest.ResponseRecorder
		want int
	}{
		"bad signature": {func() *httptest.ResponseRecorder { return f.send(washerEvent, "wrong-secret", f.now, id) }, http.StatusUnauthorized},
		"stale": {func() *httptest.ResponseRecorder {
			return f.send(washerEvent, webhookSecret, f.now.Add(-301*time.Second), id)
		}, http.StatusUnauthorized},
		"future": {func() *httptest.ResponseRecorder {
			return f.send(washerEvent, webhookSecret, f.now.Add(301*time.Second), id)
		}, http.StatusUnauthorized},
		"unknown id":   {func() *httptest.ResponseRecorder { return f.send(washerEvent, webhookSecret, f.now, uuid.NewString()) }, http.StatusNotFound},
		"malformed id": {func() *httptest.ResponseRecorder { return f.send(washerEvent, webhookSecret, f.now, "1") }, http.StatusNotFound},
		"bad payload": {func() *httptest.ResponseRecorder {
			return f.send(`{"event_id":"has space","event_type":"x"}`, webhookSecret, f.now, id)
		}, http.StatusUnprocessableEntity},
		"unknown field": {func() *httptest.ResponseRecorder {
			return f.send(`{"event_id":"a","event_type":"x","household_id":"y"}`, webhookSecret, f.now, id)
		}, http.StatusUnprocessableEntity},
		"too large": {func() *httptest.ResponseRecorder {
			return f.send(strings.Repeat("x", MaxWebhookBody+1), webhookSecret, f.now, id)
		}, http.StatusRequestEntityTooLarge},
	}
	for name, tc := range cases {
		if rec := tc.rec(); rec.Code != tc.want {
			t.Errorf("%s: want %d, got %d %s", name, tc.want, rec.Code, rec.Body.String())
		}
	}
	if len(f.keys) != 0 {
		t.Fatalf("no rejected request may execute an action: %v", f.keys)
	}

	req := httptest.NewRequest(http.MethodPost, EventsPath, strings.NewReader(washerEvent))
	req.Header.Set(HeaderWebhookID, id)
	req.Header.Set(HeaderTimestamp, strconv.FormatInt(f.now.Unix(), 10))
	req.Header.Set(HeaderSignature, "md5=abc")
	rec := httptest.NewRecorder()
	f.hook.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("wrong signature scheme: %d", rec.Code)
	}
}

func TestWebhook_DisabledPluginAndStoreErrors(t *testing.T) {
	f := newWebhookFixture(t, true)
	inst := f.access.inst[hhA]
	inst.Enabled = false
	f.access.inst[hhA] = inst
	if rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String()); rec.Code != http.StatusNotFound {
		t.Fatalf("a disabled plugin answers 404: %d", rec.Code)
	}
	f.access.err = errors.New("db down")
	if rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String()); rec.Code != http.StatusInternalServerError {
		t.Fatalf("plugin lookup failure: %d", rec.Code)
	}
	f.secrets.err = errors.New("db down")
	if rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String()); rec.Code != http.StatusInternalServerError {
		t.Fatalf("secret lookup failure: %d", rec.Code)
	}
	f.secrets.err = nil
	f.secrets.rows[f.pluginID] = SealedSecret{HouseholdID: hhA, Sealed: []byte("junk"), KeyID: "v1"}
	if rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String()); rec.Code != http.StatusUnauthorized {
		t.Fatalf("an unreadable secret authenticates nothing: %d", rec.Code)
	}
}

type failingEvents struct{}

func (failingEvents) Handle(context.Context, actions.Event) (actions.Outcome, error) {
	return actions.Outcome{}, errors.New("db down")
}

func TestWebhook_HandlerErrorAndOutcomeStatus(t *testing.T) {
	f := newWebhookFixture(t, true)
	f.hook.handler = failingEvents{}
	if rec := f.send(washerEvent, webhookSecret, f.now, f.pluginID.String()); rec.Code != http.StatusInternalServerError {
		t.Fatalf("handler failure: %d", rec.Code)
	}
	if outcomeStatus(actions.Outcome{Status: actions.StatusFailed}) != http.StatusBadGateway {
		t.Error("a failed action answers 502")
	}
}
