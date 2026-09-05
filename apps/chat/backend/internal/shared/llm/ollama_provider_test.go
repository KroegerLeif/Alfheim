package llm

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func drainStream(t *testing.T, ch <-chan StreamChunk, timeout time.Duration) []StreamChunk {
	t.Helper()
	var chunks []StreamChunk
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case chunk, ok := <-ch:
			if !ok {
				return chunks
			}
			chunks = append(chunks, chunk)
			if chunk.Done {
				return chunks
			}
		case <-timer.C:
			t.Fatal("timed out waiting for stream chunks")
			return chunks
		}
	}
}

func TestOllamaProvider_ChatStream_TextDeltas(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Errorf("expected request to /api/chat, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/x-ndjson")
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":"Hel"},"done":false}`)
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":"lo"},"done":false}`)
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":3,"eval_count":2}`)
	}))
	defer server.Close()

	provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")

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

func TestOllamaProvider_ChatStream_ToolCall(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_stock","arguments":{"item":"milk"}}}]},"done":false}`)
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":""},"done":true}`)
	}))
	defer server.Close()

	provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")

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
	if toolCall.ToolName != "get_stock" {
		t.Errorf("expected tool name get_stock, got %s", toolCall.ToolName)
	}
	if toolCall.Arguments["item"] != "milk" {
		t.Errorf("expected argument item=milk, got %v", toolCall.Arguments)
	}
}

func TestOllamaProvider_ChatStream_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "internal server error")
	}))
	defer server.Close()

	provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")

	_, err := provider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	})
	if err == nil {
		t.Fatalf("expected error for non-200 response, got nil")
	}
}

func TestOllamaProvider_ChatStream_MidStreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":"partial"},"done":false}`)
		fmt.Fprintln(w, `{"error":"model overloaded"}`)
	}))
	defer server.Close()

	provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")

	ch, err := provider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunks := drainStream(t, ch, 2*time.Second)
	last := chunks[len(chunks)-1]
	if last.Err == nil {
		t.Fatalf("expected terminal error chunk, got none")
	}
	if !last.Done {
		t.Errorf("expected error chunk to be marked done")
	}
}

func TestOllamaProvider_HealthCheck(t *testing.T) {
	t.Run("returns ok for a reachable and successful endpoint", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/tags" {
				t.Errorf("expected request to /api/tags, got %s", r.URL.Path)
			}
			fmt.Fprint(w, `{"models":[{"name":"llama3.1:8b"}]}`)
		}))
		defer server.Close()

		provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusOK {
			t.Errorf("expected status ok, got %s (%s)", result.Status, result.Detail)
		}
	})

	t.Run("returns unreachable when the server is down", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		server.Close() // close immediately so the port is unreachable

		provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")
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

		provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusAuthInvalid {
			t.Errorf("expected status auth_invalid, got %s", result.Status)
		}
	})

	t.Run("returns unknown for unexpected status codes", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
		}))
		defer server.Close()

		provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")
		result := provider.HealthCheck(context.Background())
		if result.Status != HealthStatusUnknown {
			t.Errorf("expected status unknown, got %s", result.Status)
		}
	})
}

func TestNewProvider(t *testing.T) {
	t.Run("constructs an ollama provider", func(t *testing.T) {
		p, err := NewProvider(ProviderTypeOllama, "http://localhost:11434", "llama3.1:8b", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.Name() != "ollama" {
			t.Errorf("expected provider name ollama, got %s", p.Name())
		}
	})

	t.Run("constructs an openai-compatible provider", func(t *testing.T) {
		p, err := NewProvider(ProviderTypeOpenAICompatible, "https://api.openai.com", "gpt-4.1", "sk-test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.Name() != "openai_compatible" {
			t.Errorf("expected provider name openai_compatible, got %s", p.Name())
		}
	})

	t.Run("returns an error for not-yet-implemented providers", func(t *testing.T) {
		if _, err := NewProvider(ProviderTypeAnthropic, "https://api.anthropic.com", "claude-3", "sk-test"); err == nil {
			t.Errorf("expected error for unimplemented provider type")
		}
	})

	t.Run("returns an error for unknown provider types", func(t *testing.T) {
		if _, err := NewProvider("does-not-exist", "", "", ""); err == nil {
			t.Errorf("expected error for unknown provider type")
		}
	})
}

func TestNormalizeOllamaBaseURL(t *testing.T) {
	if got := NormalizeOllamaBaseURL(""); got != DefaultOllamaBaseURL {
		t.Errorf("expected default URL, got %s", got)
	}
	if got := NormalizeOllamaBaseURL("  "); got != DefaultOllamaBaseURL {
		t.Errorf("expected default URL for whitespace, got %s", got)
	}
	if got := NormalizeOllamaBaseURL("localhost:11434/"); got != "http://localhost:11434" {
		t.Errorf("expected prefixed scheme, got %s", got)
	}
	if got := NormalizeOllamaBaseURL("https://my-ollama.internal:11434/"); got != "https://my-ollama.internal:11434" {
		t.Errorf("expected https scheme preserved, got %s", got)
	}
}

func TestOllamaProvider_ChatStream_ReplayAssistantToolCallsAndErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		fmt.Fprintln(w, `{"message":{"role":"assistant","content":"Done"},"done":true}`)
	}))
	defer server.Close()

	provider := NewOllamaProvider(server.URL, "llama3.1:8b", "")

	// Replay assistant tool calls
	req := ChatRequest{
		Messages: []Message{
			{
				Role: RoleAssistant,
				ToolCalls: []ToolCallRequest{
					{
						ID:       "call-1",
						ToolName: "test_tool",
						Arguments: map[string]any{
							"param": "value",
						},
					},
				},
			},
			{
				Role:    RoleUser,
				Content: "continue",
			},
		},
		Tools: []ToolDefinition{
			{Name: "test_tool", Description: "desc", Parameters: map[string]any{"type": "object"}},
		},
		Stream: true,
	}

	ch, err := provider.ChatStream(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	chunks := drainStream(t, ch, 2*time.Second)
	if len(chunks) == 0 {
		t.Fatal("expected at least one chunk")
	}

	// Test non-200 error from server
	errServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer errServer.Close()

	errProvider := NewOllamaProvider(errServer.URL, "llama3.1:8b", "")
	_, err = errProvider.ChatStream(context.Background(), ChatRequest{
		Messages: []Message{{Role: RoleUser, Content: "hi"}},
		Stream:   true,
	})
	if err == nil {
		t.Errorf("expected error when server returns 500, got nil")
	}
}

func TestOllamaProvider_EdgeCases(t *testing.T) {
	t.Run("sends auth header when apiKey is configured", func(t *testing.T) {
		var receivedAuth string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedAuth = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/x-ndjson")
			fmt.Fprintln(w, `{"message":{"role":"assistant","content":"ok"},"done":true}`)
		}))
		defer server.Close()

		p := NewOllamaProvider(server.URL, "llama3.1:8b", "secret-token")
		ch, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		drainStream(t, ch, 2*time.Second)
		if receivedAuth != "Bearer secret-token" {
			t.Errorf("expected auth header Bearer secret-token, got %s", receivedAuth)
		}

		// HealthCheck with auth
		serverHealth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer secret-token" {
				t.Errorf("expected auth header on health check, got %s", r.Header.Get("Authorization"))
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"models":[]}`))
		}))
		defer serverHealth.Close()

		pHealth := NewOllamaProvider(serverHealth.URL, "llama3.1:8b", "secret-token")
		res := pHealth.HealthCheck(context.Background())
		if res.Status != HealthStatusOK {
			t.Errorf("expected HealthStatusOK, got %s", res.Status)
		}
	})

	t.Run("handles corrupt json in health check", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`not valid json`))
		}))
		defer server.Close()

		p := NewOllamaProvider(server.URL, "llama3.1:8b", "")
		res := p.HealthCheck(context.Background())
		if res.Status != HealthStatusUnknown {
			t.Errorf("expected unknown status on corrupt json, got %s", res.Status)
		}
	})

	t.Run("handles stream ending without done flag cleanly", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/x-ndjson")
			fmt.Fprintln(w, "") // empty line
			fmt.Fprintln(w, `{"message":{"role":"assistant","content":"partial content"}}`)
			// Stream closes without done: true
		}))
		defer server.Close()

		p := NewOllamaProvider(server.URL, "llama3.1:8b", "")
		ch, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		chunks := drainStream(t, ch, 2*time.Second)
		if len(chunks) == 0 {
			t.Fatal("expected chunks")
		}
		last := chunks[len(chunks)-1]
		if !last.Done {
			t.Errorf("expected last chunk to be marked done")
		}
	})

	t.Run("returns error when server connection fails in ChatStream", func(t *testing.T) {
		p := NewOllamaProvider("http://127.0.0.1:54321", "llama3.1:8b", "")
		_, err := p.ChatStream(context.Background(), ChatRequest{
			Messages: []Message{{Role: RoleUser, Content: "hi"}},
			Stream:   true,
		})
		if err == nil {
			t.Errorf("expected connection error, got nil")
		}
	})

	t.Run("handles corrupt json line midstream", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/x-ndjson")
			fmt.Fprintln(w, `{"message":{"role":"assistant","content":"start"}`) // malformed JSON
		}))
		defer server.Close()

		p := NewOllamaProvider(server.URL, "llama3.1:8b", "")
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
			t.Errorf("expected error chunk for malformed json stream line")
		}
	})
}
