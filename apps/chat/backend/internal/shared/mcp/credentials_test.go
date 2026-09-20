package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type seenHeaders struct {
	method        string
	authorization string
	householdID   string
}

// newRecordingMCPServer is a minimal MCP server that records the auth-related
// headers of every request it receives.
func newRecordingMCPServer(t *testing.T) (*httptest.Server, func() []seenHeaders) {
	t.Helper()
	var mu sync.Mutex
	var seen []seenHeaders

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode request: %v", err)
			return
		}
		mu.Lock()
		seen = append(seen, seenHeaders{method: req.Method, authorization: r.Header.Get("Authorization"), householdID: r.Header.Get("X-Household-ID")})
		mu.Unlock()

		w.Header().Set(headerSessionID, "s-1")
		switch req.Method {
		case "initialize":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"t","version":"1"}}}`, req.ID)
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/list":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"t1","inputSchema":{}}]}}`, req.ID)
		case "tools/call":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"ok"}]}}`, req.ID)
		}
	}))
	t.Cleanup(server.Close)

	return server, func() []seenHeaders {
		mu.Lock()
		defer mu.Unlock()
		return append([]seenHeaders(nil), seen...)
	}
}

func TestClient_ForwardsCallerCredentialsOnEveryRequest(t *testing.T) {
	server, seen := newRecordingMCPServer(t)
	client := NewClient(server.URL)

	ctx := WithCallerCredentials(context.Background(), CallerCredentials{AccessToken: "user-token-A", HouseholdID: "11111111-1111-1111-1111-111111111111"})
	if _, _, err := client.CallTool(ctx, "t1", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	requests := seen()
	if len(requests) != 3 { // initialize, notifications/initialized, tools/call
		t.Fatalf("expected 3 requests, got %d: %+v", len(requests), requests)
	}
	for _, r := range requests {
		if r.authorization != "Bearer user-token-A" {
			t.Errorf("%s: expected forwarded bearer token, got %q", r.method, r.authorization)
		}
		if r.householdID != "11111111-1111-1111-1111-111111111111" {
			t.Errorf("%s: expected forwarded household id, got %q", r.method, r.householdID)
		}
	}

	// A different caller on the same pooled client must send its own credentials,
	// never the first caller's.
	ctxB := WithCallerCredentials(context.Background(), CallerCredentials{AccessToken: "user-token-B", HouseholdID: "22222222-2222-2222-2222-222222222222"})
	if _, _, err := client.CallTool(ctxB, "t1", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	last := seen()[len(seen())-1]
	if last.authorization != "Bearer user-token-B" || last.householdID != "22222222-2222-2222-2222-222222222222" {
		t.Errorf("expected second caller's credentials, got %+v", last)
	}
}

func TestClient_SendsNoCredentialsWithoutCaller(t *testing.T) {
	server, seen := newRecordingMCPServer(t)
	client := NewClient(server.URL)

	if _, err := client.ListTools(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, r := range seen() {
		if r.authorization != "" || r.householdID != "" {
			t.Errorf("%s: expected no forwarded credentials, got %+v", r.method, r)
		}
	}
}

func TestClient_HonorsContextCancellation(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	defer close(release)

	client := NewClient(server.URL)

	t.Run("cancel", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			time.Sleep(50 * time.Millisecond)
			cancel()
		}()
		start := time.Now()
		_, _, err := client.CallTool(ctx, "t1", nil)
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context.Canceled, got %v", err)
		}
		if time.Since(start) > 5*time.Second {
			t.Fatalf("call did not return promptly after cancellation")
		}
	})

	t.Run("deadline", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		_, err := client.ListTools(ctx)
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("expected context.DeadlineExceeded, got %v", err)
		}
	})
}

func TestCallerCredentials_StringRedactsToken(t *testing.T) {
	creds := CallerCredentials{AccessToken: "super-secret-token", HouseholdID: "hh"}
	for _, s := range []string{creds.String(), fmt.Sprintf("%v", creds), fmt.Sprintf("%+v", creds)} {
		if strings.Contains(s, "super-secret-token") {
			t.Fatalf("token leaked in %q", s)
		}
	}
}
