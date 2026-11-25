package homeassistant

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
)

func TestMemberHandler_Status(t *testing.T) {
	d := newHADouble(t)
	inst := instance(hhA, d.srv.URL, `{"allow_control":true}`)
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: inst}}
	log, buf := bufLog()
	h := NewMemberHandler(access, NewStates(access, testClient()), log)

	rec := do(h.Status, http.MethodGet, "/status", hhA, "", nil)
	var got StatusResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || !got.Enabled || !got.MCPAvailable || !got.AllowControl {
		t.Fatalf("status A: %s", rec.Body.String())
	}
	if rec = do(h.Status, http.MethodGet, "/status", hhB, "", nil); rec.Code != http.StatusOK ||
		strings.Contains(rec.Body.String(), "true") {
		t.Fatalf("household B has no plugin: %s", rec.Body.String())
	}
	inst.Config.Settings = json.RawMessage(`{"x":1}`)
	access.inst[hhA] = inst
	if rec = do(h.Status, http.MethodGet, "/status", hhA, "", nil); rec.Code != http.StatusInternalServerError {
		t.Fatalf("bad settings: %d", rec.Code)
	}
	access.err = plugins.ErrEncryptionUnavailable
	if rec = do(h.Status, http.MethodGet, "/status", hhA, "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("unreadable credentials with an unreadable row: %d", rec.Code)
	}
	access.err = errors.New("db down")
	if rec = do(h.Status, http.MethodGet, "/status", hhA, "", nil); rec.Code != http.StatusInternalServerError {
		t.Fatalf("db error: %d", rec.Code)
	}
	assertNoToken(t, rec.Body.String(), buf.String())
}

// statusOnlyAccess fails Instance with ErrKeyMismatch but still answers IsEnabled.
type statusOnlyAccess struct {
	*fakeAccess
	enabledErr error
}

func (s *statusOnlyAccess) Instance(context.Context, uuid.UUID, string) (plugins.Instance, error) {
	return plugins.Instance{}, plugins.ErrKeyMismatch
}

func (s *statusOnlyAccess) IsEnabled(context.Context, uuid.UUID, string) (bool, error) {
	return s.enabledErr == nil, s.enabledErr
}

func doWithoutHousehold(hf http.HandlerFunc) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	hf(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{}")))
	return rec
}

func TestMemberHandler_StatesAndStatusWithUnreadableKey(t *testing.T) {
	d := newHADouble(t)
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: instance(hhA, d.srv.URL, `{"pinned_entities":["sensor.temp"]}`)}}
	log, buf := bufLog()
	h := NewMemberHandler(access, NewStates(access, testClient()), log)
	rec := do(h.States, http.MethodGet, "/states", hhA, "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"21.5"`) {
		t.Fatalf("states: %d %s", rec.Code, rec.Body.String())
	}
	if rec = do(h.States, http.MethodGet, "/states", hhB, "", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("states of B: %d", rec.Code)
	}
	assertNoToken(t, rec.Body.String(), buf.String())

	wrapped := &statusOnlyAccess{fakeAccess: access}
	h = NewMemberHandler(wrapped, nil, log)
	rec = do(h.Status, http.MethodGet, "/status", hhA, "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"enabled":true`) || !strings.Contains(rec.Body.String(), `"mcp_available":false`) {
		t.Fatalf("unreadable credentials: %d %s", rec.Code, rec.Body.String())
	}
	wrapped.enabledErr = errors.New("db down")
	if rec = do(h.Status, http.MethodGet, "/status", hhA, "", nil); rec.Code != http.StatusInternalServerError {
		t.Fatalf("enabled lookup failure: %d", rec.Code)
	}
}

func TestSecretHandler_InfoAndRotate(t *testing.T) {
	inst := instance(hhA, "http://ha.lan", `{}`)
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: inst}}
	store := &memSecrets{rows: map[uuid.UUID]SealedSecret{}}
	log, buf := bufLog()
	h := NewSecretHandler(access, store, testCipher, log)

	rec := do(h.Info, http.MethodGet, "/webhook", hhA, "", nil)
	if !strings.Contains(rec.Body.String(), `"has_secret":false`) || !strings.Contains(rec.Body.String(), inst.ID.String()) {
		t.Fatalf("info before rotate: %s", rec.Body.String())
	}
	rec = do(h.Rotate, http.MethodPost, "/webhook/secret", hhA, "", nil)
	var got SecretResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || len(got.Secret) < 40 || got.Path != EventsPath ||
		rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("rotate: %s", rec.Body.String())
	}
	if strings.Contains(buf.String(), got.Secret) {
		t.Fatal("the secret must never be logged")
	}
	creds, err := testCipher.Open(store.rows[inst.ID].Sealed, store.rows[inst.ID].KeyID)
	if err != nil || creds[credentialSecret] != got.Secret {
		t.Fatalf("the stored secret must be sealed and match: %v", err)
	}
	if rec = do(h.Info, http.MethodGet, "/webhook", hhA, "", nil); !strings.Contains(rec.Body.String(), `"has_secret":true`) ||
		strings.Contains(rec.Body.String(), got.Secret) {
		t.Fatalf("info never shows the secret again: %s", rec.Body.String())
	}
	for _, hf := range []http.HandlerFunc{h.Info, h.Rotate} {
		if rec = do(hf, http.MethodGet, "/x", hhB, "", nil); rec.Code != http.StatusNotFound {
			t.Errorf("household B: %d", rec.Code)
		}
	}
	store.err = errors.New("db down")
	for _, hf := range []http.HandlerFunc{h.Info, h.Rotate} {
		if rec = do(hf, http.MethodGet, "/x", hhA, "", nil); rec.Code != http.StatusInternalServerError {
			t.Errorf("store failure: %d", rec.Code)
		}
	}
	noKey, err := plugins.NewCipher(nil, "")
	if err != nil {
		t.Fatal(err)
	}
	h = NewSecretHandler(access, &memSecrets{rows: map[uuid.UUID]SealedSecret{}}, noKey, log)
	if rec = do(h.Rotate, http.MethodPost, "/x", hhA, "", nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("no encryption key: %d", rec.Code)
	}
}

func TestWritePluginErr(t *testing.T) {
	log, _ := bufLog()
	for err, want := range map[error]int{
		plugins.ErrDisabled:       http.StatusNotFound,
		plugins.ErrHostNotAllowed: http.StatusBadGateway,
		ErrAuthRejected:           http.StatusBadGateway,
		ErrUpstream:               http.StatusBadGateway,
		plugins.ErrKeyMismatch:    http.StatusServiceUnavailable,
		errors.New("other"):       http.StatusInternalServerError,
	} {
		rec := do(func(w http.ResponseWriter, _ *http.Request) { writePluginErr(w, err, log) }, http.MethodGet, "/", hhA, "", nil)
		if rec.Code != want {
			t.Errorf("%v: want %d, got %d", err, want, rec.Code)
		}
	}
}

func TestHandlersWithoutHouseholdContext(t *testing.T) {
	log, _ := bufLog()
	access := &fakeAccess{}
	for name, hf := range map[string]http.HandlerFunc{
		"status": NewMemberHandler(access, nil, log).Status,
		"states": NewMemberHandler(access, nil, log).States,
		"post":   NewMCPProxy(access, nil, log).Post,
		"delete": NewMCPProxy(access, nil, log).Delete,
		"info":   NewSecretHandler(access, nil, nil, log).Info,
		"rotate": NewSecretHandler(access, nil, nil, log).Rotate,
	} {
		rec := doWithoutHousehold(hf)
		if rec.Code != http.StatusInternalServerError {
			t.Errorf("%s: %d", name, rec.Code)
		}
	}
}
