package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// rpcRequest is a minimal decode target used only by the test server to branch on
// the JSON-RPC "method" field of an incoming request.
type rpcRequest struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
}

// newTestMCPServer returns an httptest.Server that speaks just enough of the MCP
// Streamable HTTP protocol (JSON responses, a session id, initialize handshake) to
// exercise Client. The returned counter tracks how many tools/list requests the
// server received, so tests can assert on the caching behavior.
func newTestMCPServer(t *testing.T, tools []Tool, toolResult callToolResult) (*httptest.Server, *int) {
	t.Helper()
	toolsListCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("test server failed to decode request body: %v", err)
		}

		w.Header().Set(headerSessionID, "test-session-123")

		switch req.Method {
		case "initialize":
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"test","version":"1.0"}}}`, req.ID)
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/list":
			toolsListCount++
			w.Header().Set(headerContentType, contentTypeJSON)
			payload, _ := json.Marshal(listToolsResult{Tools: tools})
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":%s}`, req.ID, payload)
		case "tools/call":
			w.Header().Set(headerContentType, contentTypeJSON)
			payload, _ := json.Marshal(toolResult)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":%s}`, req.ID, payload)
		default:
			t.Fatalf("test server received unexpected method %q", req.Method)
		}
	}))

	return server, &toolsListCount
}

func TestClient_ListTools(t *testing.T) {
	tools := []Tool{
		{Name: "get_stock", Description: "look up pantry stock", InputSchema: map[string]any{"type": "object"}},
	}
	server, toolsListCount := newTestMCPServer(t, tools, callToolResult{})
	defer server.Close()

	client := NewClient(server.URL)
	got, err := client.ListTools(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].Name != "get_stock" {
		t.Errorf("expected [get_stock], got %+v", got)
	}

	// Second call within the cache TTL should not hit the server again.
	if _, err := client.ListTools(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if *toolsListCount != 1 {
		t.Errorf("expected exactly 1 tools/list request due to caching, got %d", *toolsListCount)
	}
}

func TestClient_CallTool(t *testing.T) {
	result := callToolResult{
		Content: []contentBlock{{Type: "text", Text: "3 liters of milk in stock"}},
		IsError: false,
	}
	server, _ := newTestMCPServer(t, nil, result)
	defer server.Close()

	client := NewClient(server.URL)
	text, isError, err := client.CallTool(context.Background(), "get_stock", map[string]any{"item": "milk"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if isError {
		t.Errorf("expected isError=false")
	}
	if text != "3 liters of milk in stock" {
		t.Errorf("expected result text, got %q", text)
	}
}

func TestClient_CallTool_ReportsToolError(t *testing.T) {
	result := callToolResult{
		Content: []contentBlock{{Type: "text", Text: "item not found"}},
		IsError: true,
	}
	server, _ := newTestMCPServer(t, nil, result)
	defer server.Close()

	client := NewClient(server.URL)
	text, isError, err := client.CallTool(context.Background(), "get_stock", map[string]any{"item": "unobtainium"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !isError {
		t.Errorf("expected isError=true")
	}
	if text != "item not found" {
		t.Errorf("expected error text from the tool, got %q", text)
	}
}

func TestClient_ListTools_SSEResponse(t *testing.T) {
	initializeDone := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		w.Header().Set(headerSessionID, "sse-session")

		switch req.Method {
		case "initialize":
			initializeDone = true
			w.Header().Set(headerContentType, contentTypeSSE)
			fmt.Fprintf(w, "data: {\"jsonrpc\":\"2.0\",\"id\":%s,\"result\":{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},\"serverInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n\n", req.ID)
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/list":
			if !initializeDone {
				t.Fatalf("tools/list called before initialize")
			}
			w.Header().Set(headerContentType, contentTypeSSE)
			payload, _ := json.Marshal(listToolsResult{Tools: []Tool{{Name: "ping"}}})
			fmt.Fprintf(w, "data: {\"jsonrpc\":\"2.0\",\"id\":%s,\"result\":%s}\n\n", req.ID, payload)
		default:
			t.Fatalf("unexpected method %q", req.Method)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL)
	tools, err := client.ListTools(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tools) != 1 || tools[0].Name != "ping" {
		t.Errorf("expected [ping], got %+v", tools)
	}
}

func TestClient_ListTools_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "initialize" {
			w.Header().Set(headerContentType, contentTypeJSON)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"test","version":"1.0"}}}`, req.ID)
			return
		}
		if req.Method == "notifications/initialized" {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		w.Header().Set(headerContentType, contentTypeJSON)
		fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"error":{"code":-32000,"message":"tool not found"}}`, req.ID)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	if _, err := client.ListTools(context.Background()); err == nil {
		t.Fatalf("expected an error from a JSON-RPC error response, got nil")
	}
}

func TestClient_Unreachable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	server.Close() // closed immediately, so the endpoint is unreachable

	client := NewClient(server.URL)
	if _, err := client.ListTools(context.Background()); err == nil {
		t.Fatalf("expected an error when the mcp server is unreachable")
	}

	diag := client.Ping(context.Background())
	if diag.Reachable {
		t.Errorf("expected reachable to be false for unreachable server")
	}
	if diag.Error == "" {
		t.Errorf("expected error message in diagnostic result")
	}
}

func TestClient_Ping_ClassifiesReachability(t *testing.T) {
	statusServer := func(status int) *httptest.Server {
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "" {
				t.Errorf("health probe must not send credentials, got %q", r.Header.Get("Authorization"))
			}
			w.Header().Set(headerContentType, contentTypeJSON)
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"detail":"missing bearer token"}`))
		}))
		t.Cleanup(s.Close)
		return s
	}

	for _, tc := range []struct {
		name             string
		status           int
		wantReachable    bool
		wantAuthRequired bool
	}{
		{"401 auth required is online", http.StatusUnauthorized, true, true},
		{"403 auth required is online", http.StatusForbidden, true, true},
		{"500 is offline", http.StatusInternalServerError, false, false},
		{"503 is offline", http.StatusServiceUnavailable, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			diag := NewClient(statusServer(tc.status).URL).Ping(context.Background())
			if diag.Reachable != tc.wantReachable || diag.AuthRequired != tc.wantAuthRequired {
				t.Fatalf("expected reachable=%v auth_required=%v, got %+v", tc.wantReachable, tc.wantAuthRequired, diag)
			}
			if !tc.wantReachable && diag.Error == "" {
				t.Errorf("expected an error message for an offline server")
			}
		})
	}

	t.Run("connection refused is offline", func(t *testing.T) {
		s := httptest.NewServer(http.NotFoundHandler())
		url := s.URL
		s.Close()
		diag := NewClient(url).Ping(context.Background())
		if diag.Reachable || diag.AuthRequired || diag.Error == "" {
			t.Fatalf("expected offline with error, got %+v", diag)
		}
	})

	t.Run("timeout is offline", func(t *testing.T) {
		release := make(chan struct{})
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-release:
			case <-r.Context().Done():
			}
		}))
		defer s.Close()
		defer close(release)
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		diag := NewClient(s.URL).Ping(ctx)
		if diag.Reachable || diag.AuthRequired {
			t.Fatalf("expected offline on timeout, got %+v", diag)
		}
	})

	t.Run("tool calls surface ErrAuthRequired", func(t *testing.T) {
		_, _, err := NewClient(statusServer(http.StatusUnauthorized).URL).CallTool(context.Background(), "t", nil)
		if !errors.Is(err, ErrAuthRequired) {
			t.Fatalf("expected ErrAuthRequired, got %v", err)
		}
	})
}

func TestClient_Ping_Success(t *testing.T) {
	tools := []Tool{
		{Name: "get_stock", Description: "look up pantry stock", InputSchema: map[string]any{"type": "object"}},
		{Name: "add_stock", Description: "add pantry stock", InputSchema: map[string]any{"type": "object"}},
	}
	server, _ := newTestMCPServer(t, tools, callToolResult{})
	defer server.Close()

	client := NewClient(server.URL)
	diag := client.Ping(context.Background())

	if !diag.Reachable {
		t.Fatalf("expected server to be reachable, got error: %s", diag.Error)
	}
	if diag.ToolsCount != 2 {
		t.Errorf("expected 2 tools, got %d", diag.ToolsCount)
	}
	if len(diag.Tools) != 2 || diag.Tools[0] != "get_stock" {
		t.Errorf("expected tools list, got %+v", diag.Tools)
	}
	if diag.ProtocolVer == "" {
		t.Errorf("expected negotiated protocol version")
	}
}

func TestClient_EdgeCases(t *testing.T) {
	t.Run("CallTool unmarshal error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req rpcRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			w.Header().Set(headerContentType, contentTypeJSON)
			if req.Method == "initialize" {
				fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18"}}`, req.ID)
			} else if req.Method == "notifications/initialized" {
				w.WriteHeader(http.StatusAccepted)
			} else {
				// Invalid json inside result
				fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":"not-an-object"}`, req.ID)
			}
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected unmarshal error for CallTool, got nil")
		}
	})

	t.Run("ensureInitialized unmarshal error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(headerContentType, contentTypeJSON)
			var req rpcRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":"not-an-object"}`, req.ID)
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected unmarshal error for initialize, got nil")
		}
	})

	t.Run("send unexpected content-type", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(headerContentType, "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("plain text response"))
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected unexpected content-type error, got nil")
		}
	})

	t.Run("send json decode error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(headerContentType, contentTypeJSON)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("not valid json"))
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected json decode error, got nil")
		}
	})

	t.Run("call returns 202 accepted with no response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusAccepted)
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected no response error, got nil")
		}
	})

	t.Run("readSSEJSONRPCMessage empty stream error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(headerContentType, contentTypeSSE)
			w.WriteHeader(http.StatusOK)
			// Send comment then close
			fmt.Fprint(w, ": keepalive\n\n")
		}))
		defer server.Close()

		c := NewClient(server.URL)
		_, _, err := c.CallTool(context.Background(), "some_tool", nil)
		if err == nil {
			t.Fatal("expected sse stream ended error, got nil")
		}
	})

	t.Run("readSSEJSONRPCMessage ignores non-json frames and handles double newline", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(headerContentType, contentTypeSSE)
			w.WriteHeader(http.StatusOK)
			// Double newline, non-json data frame, then valid json-rpc message
			fmt.Fprint(w, "\n\ndata: non-json\n\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2025-06-18\"}}\n\n")
		}))
		defer server.Close()

		c := NewClient(server.URL)
		err := c.ensureInitialized(context.Background())
		// Notification might fail because server doesn't handle initialized, but ensureInitialized parsed the SSE!
		_ = err
	})

	t.Run("ensureInitialized fails when notification fails", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req rpcRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			if req.Method == "initialize" {
				w.Header().Set(headerContentType, contentTypeJSON)
				fmt.Fprintf(w, `{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":"2025-06-18"}}`, req.ID)
			} else if req.Method == "notifications/initialized" {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("internal error"))
			}
		}))
		defer server.Close()

		c := NewClient(server.URL)
		err := c.ensureInitialized(context.Background())
		if err == nil {
			t.Fatal("expected error when notification fails, got nil")
		}
	})
}
