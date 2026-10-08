package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const (
	householdA = "11111111-1111-1111-1111-111111111111"
	householdB = "22222222-2222-2222-2222-222222222222"
)

func credsCtx(user, household string) context.Context {
	return WithCallerCredentials(context.Background(), CallerCredentials{
		AccessToken: "token-" + user,
		HouseholdID: household,
		UserID:      user,
	})
}

func TestClientPool_KeepsOneClientPerEndpointAndCaller(t *testing.T) {
	pool := NewClientPool()
	pantry := "http://pantry-backend:8000/mcp"
	chores := "http://chores-backend:8000/mcp"

	a1 := pool.clientFor(credsCtx("alice", householdA), pantry)
	a2 := pool.clientFor(credsCtx("alice", householdA), pantry)
	if a1 != a2 {
		t.Errorf("expected the same client for the same endpoint, user and household")
	}

	distinct := map[string]*Client{
		"other household":      pool.clientFor(credsCtx("alice", householdB), pantry),
		"other user":           pool.clientFor(credsCtx("bob", householdA), pantry),
		"other endpoint":       pool.clientFor(credsCtx("alice", householdA), chores),
		"anonymous":            pool.clientFor(context.Background(), pantry),
		"token without userID": pool.clientFor(WithCallerCredentials(context.Background(), CallerCredentials{AccessToken: "t-1", HouseholdID: householdA}), pantry),
		"other token":          pool.clientFor(WithCallerCredentials(context.Background(), CallerCredentials{AccessToken: "t-2", HouseholdID: householdA}), pantry),
	}
	seen := map[*Client]string{a1: "alice/A/pantry"}
	for name, c := range distinct {
		if prev, ok := seen[c]; ok {
			t.Errorf("%s reused the client of %s", name, prev)
		}
		seen[c] = name
	}
	if got := pool.size(); got != 7 {
		t.Errorf("expected 7 pooled clients, got %d", got)
	}
}

func TestClientPool_GetResolvesClientPerCall(t *testing.T) {
	pool := NewClientPool()
	pool.Get("http://pantry-backend:8000/mcp")
	if got := pool.size(); got != 0 {
		t.Fatalf("Get must not create a client before a call names its caller, got %d", got)
	}
}

func TestClientPool_DropsIdleClients(t *testing.T) {
	pool := NewClientPool()
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	pool.now = func() time.Time { return clock }

	first := pool.clientFor(credsCtx("alice", householdA), "http://pantry-backend:8000/mcp")
	clock = clock.Add(clientIdleTTL + sweepInterval)
	pool.clientFor(credsCtx("bob", householdB), "http://pantry-backend:8000/mcp")

	if got := pool.size(); got != 1 {
		t.Fatalf("expected the idle client to be dropped, %d clients remain", got)
	}
	if again := pool.clientFor(credsCtx("alice", householdA), "http://pantry-backend:8000/mcp"); again == first {
		t.Fatalf("expected a fresh client after the idle one was dropped")
	}
}

type sessionRecord struct {
	sessionID   string
	householdID string
	auth        string
	method      string
}

// newSessionMCPServer issues a new session id per initialize and answers tools/list
// with a tool named after the requesting household, so leaked sessions or cached
// tool lists are observable.
func newSessionMCPServer(t *testing.T) (*httptest.Server, func() []sessionRecord) {
	t.Helper()
	var mu sync.Mutex
	var records []sessionRecord
	var nextSession int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode request: %v", err)
			return
		}
		session := r.Header.Get(headerSessionID)
		if req.Method == "initialize" {
			session = fmt.Sprintf("session-%d", atomic.AddInt64(&nextSession, 1))
			w.Header().Set(headerSessionID, session)
		}
		household := r.Header.Get(headerHouseholdID)
		mu.Lock()
		records = append(records, sessionRecord{sessionID: session, householdID: household, auth: r.Header.Get(headerAuthorization), method: req.Method})
		mu.Unlock()

		switch req.Method {
		case "initialize":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"t","version":"1"}}}`, req.ID)
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/list":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"tool-for-%s","inputSchema":{}}]}}`, req.ID, household)
		case "tools/call":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"%s"}]}}`, req.ID, household)
		}
	}))
	t.Cleanup(server.Close)
	return server, func() []sessionRecord {
		mu.Lock()
		defer mu.Unlock()
		return append([]sessionRecord(nil), records...)
	}
}

func TestClientPool_ConcurrentCallersNeverShareSessions(t *testing.T) {
	server, records := newSessionMCPServer(t)
	pool := NewClientPool()
	caller := pool.Get(server.URL)

	callers := []struct{ user, household string }{
		{"alice", householdA},
		{"bob", householdB},
		{"carol", householdA},
	}

	var wg sync.WaitGroup
	errs := make(chan error, 64)
	for _, c := range callers {
		for range 8 {
			wg.Add(1)
			go func(user, household string) {
				defer wg.Done()
				ctx := credsCtx(user, household)
				tools, err := caller.ListTools(ctx)
				if err != nil {
					errs <- err
					return
				}
				if len(tools) != 1 || tools[0].Name != "tool-for-"+household {
					errs <- fmt.Errorf("%s/%s saw another household's tools: %+v", user, household, tools)
					return
				}
				text, _, err := caller.CallTool(ctx, "t", nil)
				if err != nil {
					errs <- err
					return
				}
				if text != household {
					errs <- fmt.Errorf("%s/%s got a result for household %q", user, household, text)
				}
			}(c.user, c.household)
		}
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}

	// Every session id must only ever be used by one (user, household) pair.
	owner := map[string]string{}
	for _, rec := range records() {
		if rec.sessionID == "" {
			t.Errorf("%s request was sent without a session id", rec.method)
			continue
		}
		identity := rec.auth + "|" + rec.householdID
		if prev, ok := owner[rec.sessionID]; ok && prev != identity {
			t.Errorf("session %s was used by %q and %q", rec.sessionID, prev, identity)
		}
		owner[rec.sessionID] = identity
	}
	identities := map[string]bool{}
	for _, identity := range owner {
		identities[identity] = true
	}
	if len(identities) != len(callers) {
		t.Errorf("expected sessions for %d distinct callers, got %d", len(callers), len(identities))
	}
}
