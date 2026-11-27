package homeassistant

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/household"
	"alfheim/go-shared/netguard"
)

// testToken is the Home Assistant token every test asserts is never leaked.
const testToken = "ha-long-lived-token-SECRET-4711"

var (
	hhA = uuid.MustParse("11111111-1111-4111-8111-111111111111")
	hhB = uuid.MustParse("22222222-2222-4222-8222-222222222222")
)

// fakeAccess is the plugin service double: one instance per household.
type fakeAccess struct {
	inst map[uuid.UUID]plugins.Instance
	err  error
}

func (f *fakeAccess) Instance(_ context.Context, hh uuid.UUID, _ string) (plugins.Instance, error) {
	if f.err != nil {
		return plugins.Instance{}, f.err
	}
	inst, ok := f.inst[hh]
	if !ok {
		return plugins.Instance{}, plugins.ErrNotConfigured
	}
	return inst, nil
}

func (f *fakeAccess) EnabledInstance(ctx context.Context, hh uuid.UUID, t string) (plugins.Instance, error) {
	inst, err := f.Instance(ctx, hh, t)
	if err == nil && !inst.Enabled {
		return plugins.Instance{}, plugins.ErrDisabled
	}
	return inst, err
}

func (f *fakeAccess) IsEnabled(ctx context.Context, hh uuid.UUID, t string) (bool, error) {
	inst, err := f.Instance(ctx, hh, t)
	if err == plugins.ErrNotConfigured {
		return false, nil
	}
	return inst.Enabled, err
}

// instance returns an enabled Home Assistant instance at base with settings.
func instance(hh uuid.UUID, base, settings string) plugins.Instance {
	return plugins.Instance{
		ID: uuid.New(), HouseholdID: hh, Type: Type, Enabled: true,
		Config:      plugins.Config{BaseURL: base, Settings: json.RawMessage(settings)},
		Credentials: plugins.Credentials{CredentialToken: testToken},
	}
}

// haDouble is an httptest Home Assistant. It answers 401 to any other token.
type haDouble struct {
	srv   *httptest.Server
	mu    sync.Mutex
	calls map[string]int
	mcp   func(w http.ResponseWriter, body []byte)
}

func newHADouble(t *testing.T) *haDouble {
	t.Helper()
	d := &haDouble{calls: map[string]int{}}
	d.srv = httptest.NewServer(http.HandlerFunc(d.serve))
	t.Cleanup(d.srv.Close)
	return d
}

func (d *haDouble) serve(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	d.calls[r.Method+" "+r.URL.Path]++
	mcp := d.mcp
	d.mu.Unlock()
	if r.Header.Get("Authorization") != "Bearer "+testToken {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	switch {
	case r.URL.Path == "/api/":
		_, _ = w.Write([]byte(`{"message": "API running."}`))
	case r.URL.Path == "/api/states/sensor.temp":
		_, _ = w.Write([]byte(`{"entity_id":"sensor.temp","state":"21.5","last_changed":"2026-11-24T08:00:00Z",
			"attributes":{"friendly_name":"Living room","unit_of_measurement":"°C"}}`))
	case r.URL.Path == "/api/states/sensor.broken":
		w.WriteHeader(http.StatusInternalServerError)
	case r.URL.Path == "/api/mcp" && mcp != nil:
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Mcp-Session-Id", "session-1")
		mcp(w, body)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (d *haDouble) count(key string) int {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.calls[key]
}

// testClient reaches the loopback double through netguard.
func testClient() *http.Client {
	g, err := netguard.New("127.0.0.1")
	if err != nil {
		panic(err)
	}
	return plugins.NewHTTPClient(g, 2*time.Second)
}

// blockedClient is a netguard client that allows no private host.
func blockedClient() *http.Client {
	g, err := netguard.New("")
	if err != nil {
		panic(err)
	}
	return plugins.NewHTTPClient(g, 2*time.Second)
}

func bufLog() (*slog.Logger, *bytes.Buffer) {
	var buf bytes.Buffer
	return slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})), &buf
}

// assertNoToken fails when any text contains the Home Assistant token.
func assertNoToken(t *testing.T, texts ...string) {
	t.Helper()
	for _, s := range texts {
		if strings.Contains(s, testToken) {
			t.Fatalf("the Home Assistant token leaked: %s", s)
		}
	}
}

// withHousehold returns r carrying a confirmed household context.
func withHousehold(r *http.Request, hh uuid.UUID, role household.Role) *http.Request {
	return r.WithContext(household.ContextWithHousehold(r.Context(),
		&household.HouseholdContext{HouseholdID: hh, Role: role, Subject: "user-1"}))
}

// do runs handler on a request with a household context.
func do(handler http.HandlerFunc, method, path string, hh uuid.UUID, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := withHousehold(httptest.NewRequest(method, path, strings.NewReader(body)), hh, household.RoleMember)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}
