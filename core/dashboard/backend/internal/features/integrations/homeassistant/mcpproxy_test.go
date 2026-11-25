package homeassistant

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"alfheim/dashboard/internal/features/plugins"
)

const toolsList = `{"jsonrpc":"2.0","id":1,"result":{"tools":[` +
	`{"name":"GetLiveContext"},{"name":"HassTurnOn"},{"name":"todo_get_items"},{"name":"HassLightSet"}]}}`

func proxyFixture(t *testing.T, settings string) (*haDouble, *MCPProxy, *bytes.Buffer) {
	t.Helper()
	d := newHADouble(t)
	d.mcp = func(w http.ResponseWriter, body []byte) {
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(string(body), `"tools/list"`) {
			_, _ = w.Write([]byte(toolsList))
			return
		}
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":2,"result":{"content":[]}}`))
	}
	log, buf := bufLog()
	access := &fakeAccess{inst: map[uuid.UUID]plugins.Instance{hhA: instance(hhA, d.srv.URL, settings)}}
	return d, NewMCPProxy(access, testClient(), log), buf
}

func toolNames(t *testing.T, body string) []string {
	t.Helper()
	var msg struct {
		Result struct {
			Tools []struct{ Name string } `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal([]byte(body), &msg); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	names := []string{}
	for _, tool := range msg.Result.Tools {
		names = append(names, tool.Name)
	}
	return names
}

func TestMCPProxy_ReadOnlyFiltersListAndRejectsControl(t *testing.T) {
	d, p, _ := proxyFixture(t, `{}`)
	rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`,
		map[string]string{headerSessionID: "s-0", headerProtocol: "2025-06-18"})
	if rec.Code != http.StatusOK || rec.Header().Get(headerSessionID) != "session-1" {
		t.Fatalf("list: %d %v", rec.Code, rec.Header())
	}
	if got := strings.Join(toolNames(t, rec.Body.String()), ","); got != "GetLiveContext,todo_get_items" {
		t.Errorf("control tools must be filtered: %s", got)
	}

	rec = do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"HassTurnOn"}}`, nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"code":-32001`) || !strings.Contains(rec.Body.String(), `"id":7`) {
		t.Fatalf("a control call must be answered by the proxy: %d %s", rec.Code, rec.Body.String())
	}
	if d.count("POST /api/mcp") != 1 {
		t.Fatalf("a blocked call must never reach Home Assistant, calls %d", d.count("POST /api/mcp"))
	}

	batch := `[{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"GetDateTime"}},` +
		`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"HassLightSet"}}]`
	rec = do(p.Post, http.MethodPost, "/mcp", hhA, batch, nil)
	var denied []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &denied); err != nil || len(denied) != 1 || d.count("POST /api/mcp") != 1 {
		t.Fatalf("a batch with a control call is rejected: %s %v", rec.Body.String(), err)
	}

	rec = do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"GetLiveContext"}}`, nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"content"`) {
		t.Fatalf("a read-only call is forwarded: %d %s", rec.Code, rec.Body.String())
	}
	assertNoToken(t, rec.Body.String())
}

func TestMCPProxy_AllowControlForwardsEverything(t *testing.T) {
	d, p, _ := proxyFixture(t, `{"allow_control":true}`)
	rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`, nil)
	if len(toolNames(t, rec.Body.String())) != 4 {
		t.Errorf("allow_control lists every tool: %s", rec.Body.String())
	}
	rec = do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"HassTurnOn"}}`, nil)
	if rec.Code != http.StatusOK || d.count("POST /api/mcp") != 2 {
		t.Fatalf("allow_control forwards control calls: %d", rec.Code)
	}
}

func TestMCPProxy_EventStreamIsFiltered(t *testing.T) {
	d, p, _ := proxyFixture(t, `{}`)
	d.mcp = func(w http.ResponseWriter, _ []byte) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("event: message\ndata: " + toolsList + "\n\n"))
	}
	rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`, nil)
	if strings.Contains(rec.Body.String(), "HassTurnOn") || !strings.Contains(rec.Body.String(), "GetLiveContext") {
		t.Fatalf("event stream not filtered: %s", rec.Body.String())
	}
}

func TestMCPProxy_UpstreamFailuresAreNotEchoed(t *testing.T) {
	for name, tc := range map[string]struct {
		mcp  func(w http.ResponseWriter, body []byte)
		want int
	}{
		"server error": {func(w http.ResponseWriter, _ []byte) { w.WriteHeader(http.StatusInternalServerError) }, http.StatusBadGateway},
		"auth":         {func(w http.ResponseWriter, _ []byte) { w.WriteHeader(http.StatusForbidden) }, http.StatusBadGateway},
		"garbage": {func(w http.ResponseWriter, _ []byte) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{not json ` + testToken))
		}, http.StatusBadGateway},
		"odd type": {func(w http.ResponseWriter, _ []byte) {
			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte(`x`))
		}, http.StatusBadGateway},
		"no type":  {func(w http.ResponseWriter, _ []byte) { _, _ = w.Write([]byte(`x`)) }, http.StatusBadGateway},
		"accepted": {func(w http.ResponseWriter, _ []byte) { w.WriteHeader(http.StatusAccepted) }, http.StatusAccepted},
	} {
		d, p, logs := proxyFixture(t, `{}`)
		d.mcp = tc.mcp
		rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{"jsonrpc":"2.0","method":"notifications/initialized"}`, nil)
		if rec.Code != tc.want {
			t.Errorf("%s: want %d, got %d %s", name, tc.want, rec.Code, rec.Body.String())
		}
		assertNoToken(t, rec.Body.String(), logs.String())
	}
}

func TestMCPProxy_RequestErrors(t *testing.T) {
	d, p, _ := proxyFixture(t, `{}`)
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `not json`, nil); rec.Code != http.StatusBadRequest {
		t.Errorf("malformed: %d", rec.Code)
	}
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `[1,`, nil); rec.Code != http.StatusBadRequest {
		t.Errorf("malformed batch: %d", rec.Code)
	}
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `[1]`, nil); rec.Code != http.StatusBadRequest {
		t.Errorf("batch of non-objects: %d", rec.Code)
	}
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, strings.Repeat("x", maxMCPRequest+1), nil); rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("too large: %d", rec.Code)
	}
	if rec := do(p.Post, http.MethodPost, "/mcp", hhB, `{}`, nil); rec.Code != http.StatusNotFound {
		t.Errorf("another household has no plugin: %d", rec.Code)
	}
	d.mcp = func(w http.ResponseWriter, _ []byte) { w.WriteHeader(http.StatusNotFound) }
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{}`, map[string]string{headerSessionID: "old"}); rec.Code != http.StatusNotFound {
		t.Errorf("an expired session answers 404: %d", rec.Code)
	}
	p.access.(*fakeAccess).inst[hhA] = instance(hhA, d.srv.URL, `{"oops":1}`)
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{}`, nil); rec.Code != http.StatusInternalServerError {
		t.Errorf("bad stored settings: %d", rec.Code)
	}
	p.access.(*fakeAccess).inst[hhA] = instance(hhA, "http://[::1", `{"allow_control":true}`)
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{}`, nil); rec.Code != http.StatusBadGateway {
		t.Errorf("bad base url: %d", rec.Code)
	}
}

func TestMCPProxy_DeleteGetAndBlockedHost(t *testing.T) {
	d, p, _ := proxyFixture(t, `{}`)
	d.mcp = func(w http.ResponseWriter, _ []byte) { w.WriteHeader(http.StatusNoContent) }
	if rec := do(p.Delete, http.MethodDelete, "/mcp", hhA, "", map[string]string{headerSessionID: "s"}); rec.Code != http.StatusNoContent {
		t.Errorf("delete: %d", rec.Code)
	}
	if rec := do(p.Delete, http.MethodDelete, "/mcp", hhB, "", nil); rec.Code != http.StatusNotFound {
		t.Errorf("delete without plugin: %d", rec.Code)
	}
	if rec := do(p.MethodNotAllowed, http.MethodGet, "/mcp", hhA, "", nil); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("get: %d", rec.Code)
	}
	p.client = blockedClient()
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{}`, nil); rec.Code != http.StatusBadGateway ||
		!strings.Contains(rec.Body.String(), CodeHostNotAllowed) {
		t.Errorf("blocked host: %d %s", rec.Code, rec.Body.String())
	}
	p.client = testClient()
	d.srv.Close()
	if rec := do(p.Post, http.MethodPost, "/mcp", hhA, `{}`, nil); rec.Code != http.StatusBadGateway {
		t.Errorf("unreachable: %d", rec.Code)
	}
}

func TestIsReadOnlyTool(t *testing.T) {
	for name, want := range map[string]bool{
		"GetLiveContext": true, "GetDateTime": true, "HassGetState": true, "todo_get_items": true,
		"calendar_get_events": true, "get_weather": true,
		"HassTurnOn": false, "HassLightSet": false, "HassCancelAllTimers": false, "": false, "SetGetter": false,
	} {
		if IsReadOnlyTool(name) != want {
			t.Errorf("%s: want %v", name, want)
		}
	}
}

func TestFilterHelpers(t *testing.T) {
	if _, err := filterToolLists([]byte(`[{"result":{"tools":[]}},{"id":1}]`)); err != nil {
		t.Errorf("batch: %v", err)
	}
	for _, bad := range []string{`{"result":{"tools":7}}`, `{"result":{"tools":[7]}}`, `[7]`} {
		if _, err := filterToolLists([]byte(bad)); err == nil {
			t.Errorf("%s: want an error", bad)
		}
	}
	if _, err := filterEventStream([]byte("data: {bad\n")); err == nil {
		t.Error("a malformed event must fail closed")
	}
	if _, err := blockedCalls([]byte(`[{"method":7}]`)); err == nil {
		t.Error("a malformed call must fail closed")
	}
}
