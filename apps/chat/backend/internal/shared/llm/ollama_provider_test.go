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

	t.Run("returns an error for not-yet-implemented providers", func(t *testing.T) {
		if _, err := NewProvider(ProviderTypeOpenAICompatible, "https://api.openai.com", "gpt-4.1", "sk-test"); err == nil {
			t.Errorf("expected error for unimplemented provider type")
		}
	})

	t.Run("returns an error for unknown provider types", func(t *testing.T) {
		if _, err := NewProvider("does-not-exist", "", "", ""); err == nil {
			t.Errorf("expected error for unknown provider type")
		}
	})
}
