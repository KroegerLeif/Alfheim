package llm

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOpenAICompatibleProvider_ChatStream_TextDeltas(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("expected request to /v1/chat/completions, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"},\"index\":0}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"},\"index\":0}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{},\"index\":0,\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")

	ch, err := provider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
		Stream:   true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunks := drainStream(t, ch, 2*time.Second)

	var text string
	for _, c := range chunks {
		text += c.DeltaText
	}
	if text != "Hello" {
		t.Errorf("expected concatenated text %q, got %q", "Hello", text)
	}

	last := chunks[len(chunks)-1]
	if !last.Done {
		t.Errorf("expected final chunk to be marked done")
	}
	if last.Usage == nil || last.Usage.PromptTokens != 3 || last.Usage.CompletionTokens != 2 {
		t.Errorf("expected usage prompt=3 completion=2, got %+v", last.Usage)
	}
}

func TestOpenAICompatibleProvider_ChatStream_ToolCall(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		// First fragment carries the tool call id and function name; arguments stream
		// in as separate JSON-string fragments, matching real OpenAI streaming behavior.
		fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"get_stock","arguments":""}}]},"index":0}]}`+"\n\n")
		fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"item\":"}}]},"index":0}]}`+"\n\n")
		fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"milk\"}"}}]},"index":0}]}`+"\n\n")
		fmt.Fprint(w, `data: {"choices":[{"delta":{},"index":0,"finish_reason":"tool_calls"}]}`+"\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")

	ch, err := provider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "how much milk do we have?"}},
		Tools: []ToolDefinition{
			{Name: "get_stock", Description: "look up pantry stock", Parameters: map[string]any{"type": "object"}},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunks := drainStream(t, ch, 2*time.Second)

	var toolCall *ToolCallRequest
	for _, c := range chunks {
		if c.ToolCall != nil {
			toolCall = c.ToolCall
		}
	}
	if toolCall == nil {
		t.Fatalf("expected a tool call chunk, got none")
	}
	if toolCall.ID != "call_abc" {
		t.Errorf("expected tool call id call_abc, got %s", toolCall.ID)
	}
	if toolCall.ToolName != "get_stock" {
		t.Errorf("expected tool name get_stock, got %s", toolCall.ToolName)
	}
	if toolCall.Arguments["item"] != "milk" {
		t.Errorf("expected argument item=milk assembled from fragments, got %v", toolCall.Arguments)
	}

	last := chunks[len(chunks)-1]
	if !last.Done {
		t.Errorf("expected final chunk to be marked done")
	}
}

func TestOpenAICompatibleProvider_ChatStream_ToolCallWithoutExplicitDone(t *testing.T) {
	// Some OpenAI-compatible servers close the connection right after the final
	// chunk instead of sending a "data: [DONE]" frame.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"ping","arguments":"{}"}}]},"index":0,"finish_reason":"tool_calls"}]}`+"\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")
	ch, err := provider.ChatStream(context.Background(), ChatRequest{Messages: []Message{{Role: RoleUser, Content: "ping"}}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunks := drainStream(t, ch, 2*time.Second)
	var found bool
	for _, c := range chunks {
		if c.ToolCall != nil && c.ToolCall.ToolName == "ping" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected the tool call to be flushed even without an explicit [DONE] frame")
	}
	if !chunks[len(chunks)-1].Done {
		t.Errorf("expected the final synthesized chunk to be marked done")
	}
}

func TestOpenAICompatibleProvider_ChatStream_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "internal server error")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")
	_, err := provider.ChatStream(context.Background(), ChatRequest{Messages: []Message{{Role: RoleUser, Content: "hi"}}})
	if err == nil {
		t.Fatalf("expected error for non-200 response, got nil")
	}
}

func TestOpenAICompatibleProvider_ChatStream_SendsAuthHeader(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test-key")
	ch, err := provider.ChatStream(context.Background(), ChatRequest{Messages: []Message{{Role: RoleUser, Content: "hi"}}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	drainStream(t, ch, 2*time.Second)

	if gotAuth != "Bearer sk-test-key" {
		t.Errorf("expected Authorization header 'Bearer sk-test-key', got %q", gotAuth)
	}
}

func TestOpenAICompatibleProvider_ChatStream_OmitsAuthHeaderWhenNoAPIKey(t *testing.T) {
	var gotAuth string
	sawRequest := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawRequest = true
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")
	ch, err := provider.ChatStream(context.Background(), ChatRequest{Messages: []Message{{Role: RoleUser, Content: "hi"}}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	drainStream(t, ch, 2*time.Second)

	if !sawRequest {
		t.Fatalf("expected the server to receive a request")
	}
	if gotAuth != "" {
		t.Errorf("expected no Authorization header when no api key is configured, got %q", gotAuth)
	}
}

func TestOpenAICompatibleProvider_HealthCheck(t *testing.T) {
	t.Run("returns ok for a reachable and successful endpoint", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/v1/models" {
				t.Errorf("expected request to /v1/models, got %s", r.URL.Path)
			}
			fmt.Fprint(w, `{"data":[{"id":"gpt-4.1"}]}`)
		}))
		defer server.Close()

		provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusOK {
			t.Errorf("expected status ok, got %s (%s)", result.Status, result.Detail)
		}
	})

	t.Run("returns unreachable when the server is down", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		server.Close()

		provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusUnreachable {
			t.Errorf("expected status unreachable, got %s", result.Status)
		}
	})

	t.Run("returns auth_invalid for 401 responses", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer server.Close()

		provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "bad-key")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusAuthInvalid {
			t.Errorf("expected status auth_invalid, got %s", result.Status)
		}
	})

	t.Run("returns auth_invalid for 403 responses", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}))
		defer server.Close()

		provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "bad-key")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusAuthInvalid {
			t.Errorf("expected status auth_invalid, got %s", result.Status)
		}
	})

	t.Run("returns unknown for unexpected status codes without leaking secrets", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
		}))
		defer server.Close()

		provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-super-secret")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusUnknown {
			t.Errorf("expected status unknown, got %s", result.Status)
		}
		if strings.Contains(result.Detail, "sk-super-secret") {
			t.Errorf("expected the api key to never appear in the health detail, got %q", result.Detail)
		}
	})
}

func TestOpenAICompatibleProvider_ReplayMessagesAndErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"},\"index\":0}]}\n\n")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	provider := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test")

	// Message sequence covering System, User, Assistant with ToolCalls (including unmarshalable args), and Tool result with ToolCallID
	req := ChatRequest{
		Messages: []Message{
			{Role: RoleSystem, Content: "You are a helpful assistant."},
			{Role: RoleUser, Content: "Find something"},
			{
				Role: RoleAssistant,
				ToolCalls: []ToolCallRequest{
					{
						ID:        "tc-1",
						ToolName:  "tool1",
						Arguments: map[string]any{"key": "val"},
					},
					{
						ID:        "tc-2",
						ToolName:  "tool2",
						Arguments: map[string]any{"bad": make(chan int)}, // forces marshal error -> "{}"
					},
				},
			},
			{
				Role:       RoleTool,
				Content:    `{"result":"found"}`,
				ToolCallID: "tc-1",
			},
		},
		Stream: true,
	}

	ch, err := provider.ChatStream(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	chunks := drainStream(t, ch, 2*time.Second)
	if len(chunks) == 0 {
		t.Fatal("expected chunks from stream")
	}

	// Server returning 500 error
	errServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal openai error"))
	}))
	defer errServer.Close()

	errProvider := NewOpenAICompatibleProvider(errServer.URL, "gpt-4.1", "sk-test")
	_, err = errProvider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
		Stream:   true,
	})
	if err == nil {
		t.Errorf("expected error when openai server returns 500, got nil")
	}
}

func TestOpenAICompatibleProvider_EdgeCases(t *testing.T) {
	t.Run("returns error when server connection fails in ChatStream", func(t *testing.T) {
		p := NewOpenAICompatibleProvider("http://127.0.0.1:54321", "gpt-4.1", "sk-test")
		_, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err == nil {
			t.Errorf("expected connection error, got nil")
		}
	})

	t.Run("handles corrupt json in health check", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`not-json`))
		}))
		defer server.Close()

		p := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test")
		res := p.HealthCheck(context.Background())
		if res.Status != HealthStatusUnknown {
			t.Errorf("expected HealthStatusUnknown on corrupt json, got %s", res.Status)
		}
	})

	t.Run("handles malformed json in stream chunk", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, "data: not-json\n\n")
		}))
		defer server.Close()

		p := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test")
		ch, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		chunks := drainStream(t, ch, 2*time.Second)
		foundErr := false
		for _, c := range chunks {
			if c.Err != nil {
				foundErr = true
				break
			}
		}
		if !foundErr {
			t.Errorf("expected error chunk for malformed stream line")
		}
	})

	t.Run("handles tool call with empty ID and corrupt args falling back cleanly", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			// No id supplied -> fallback to call_%d
			fmt.Fprint(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"foo","arguments":"not-json-args"}}]},"index":0}]}`+"\n\n")
			// Empty choices with usage
			fmt.Fprint(w, `data: {"choices":[],"usage":{"total_tokens":10}}`+"\n\n")
			fmt.Fprint(w, "data: [DONE]\n\n")
		}))
		defer server.Close()

		p := NewOpenAICompatibleProvider(server.URL, "gpt-4.1", "sk-test")
		ch, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		chunks := drainStream(t, ch, 2*time.Second)
		var tc *ToolCallRequest
		for _, c := range chunks {
			if c.ToolCall != nil {
				tc = c.ToolCall
			}
		}
		if tc == nil {
			t.Fatal("expected tool call chunk")
		}
		if tc.ID != "call_0" {
			t.Errorf("expected fallback ID call_0, got %s", tc.ID)
		}
	})
}
