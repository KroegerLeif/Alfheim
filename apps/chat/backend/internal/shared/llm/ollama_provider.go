package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DefaultOllamaBaseURL is the fallback URL when no specific host is provided.
const DefaultOllamaBaseURL = "http://host.docker.internal:11434"

// NormalizeOllamaBaseURL cleans and defaults the Ollama base URL, ensuring a scheme is present.
func NormalizeOllamaBaseURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return DefaultOllamaBaseURL
	}
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "http://" + rawURL
	}
	return strings.TrimRight(rawURL, "/")
}

// OllamaProvider talks to a local/self-hosted Ollama instance via its native
// streaming /api/chat endpoint. Ollama requires no API key when kept inside the
// protected VLAN/VPN context, so APIKey is accepted for forward compatibility
// (e.g. an authenticating reverse proxy in front of Ollama) but is optional.
type OllamaProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewOllamaProvider constructs a Provider backed by an Ollama server.
func NewOllamaProvider(baseURL, model, apiKey string) *OllamaProvider {
	return &OllamaProvider{
		baseURL:    NormalizeOllamaBaseURL(baseURL),
		model:      model,
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// Name identifies this provider implementation.
func (p *OllamaProvider) Name() string {
	return "ollama"
}

type ollamaChatMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	ToolCalls []ollamaToolCall `json:"tool_calls,omitempty"`
}

type ollamaToolCall struct {
	Function ollamaToolCallFunction `json:"function"`
}

type ollamaToolCallFunction struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type ollamaTool struct {
	Type     string             `json:"type"`
	Function ollamaToolFunction `json:"function"`
}

type ollamaToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type ollamaChatRequest struct {
	Model    string              `json:"model"`
	Messages []ollamaChatMessage `json:"messages"`
	Tools    []ollamaTool        `json:"tools,omitempty"`
	Stream   bool                `json:"stream"`
}

type ollamaChatStreamLine struct {
	Message         ollamaChatMessage `json:"message"`
	Done            bool              `json:"done"`
	PromptEvalCount int               `json:"prompt_eval_count"`
	EvalCount       int               `json:"eval_count"`
	Error           string            `json:"error"`
}

// ChatStream sends a chat request to Ollama and streams back incremental chunks.
func (p *OllamaProvider) ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	body := ollamaChatRequest{
		Model:    p.model,
		Messages: toOllamaMessages(req.Messages),
		Tools:    toOllamaTools(req.Tools),
		Stream:   true,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ollama chat request: %w", err)
	}

	endpoint := strings.TrimRight(p.baseURL, "/") + "/api/chat"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to construct ollama chat request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach ollama server: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("Ollama error (%d) for model %q: %s", resp.StatusCode, p.model, bytes.TrimSpace(respBody))
	}

	out := make(chan StreamChunk)
	go p.streamResponse(resp.Body, out)
	return out, nil
}

// streamResponse reads newline-delimited JSON chunks from Ollama and converts them
// into StreamChunk values, closing the channel once the stream is exhausted.
func (p *OllamaProvider) streamResponse(body io.ReadCloser, out chan<- StreamChunk) {
	defer close(out)
	defer body.Close()

	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	toolCallIndex := 0

	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}

		var parsed ollamaChatStreamLine
		if err := json.Unmarshal(line, &parsed); err != nil {
			out <- StreamChunk{Done: true, Err: fmt.Errorf("failed to parse ollama stream line: %w", err)}
			return
		}

		if parsed.Error != "" {
			out <- StreamChunk{Done: true, Err: errors.New(parsed.Error)}
			return
		}

		for _, tc := range parsed.Message.ToolCalls {
			out <- StreamChunk{
				ToolCall: &ToolCallRequest{
					ID:        fmt.Sprintf("call_%d", toolCallIndex),
					ToolName:  tc.Function.Name,
					Arguments: tc.Function.Arguments,
				},
			}
			toolCallIndex++
		}

		if parsed.Message.Content != "" {
			out <- StreamChunk{DeltaText: parsed.Message.Content}
		}

		if parsed.Done {
			out <- StreamChunk{
				Done: true,
				Usage: &Usage{
					PromptTokens:     parsed.PromptEvalCount,
					CompletionTokens: parsed.EvalCount,
					TotalTokens:      parsed.PromptEvalCount + parsed.EvalCount,
				},
			}
			return
		}
	}

	if err := scanner.Err(); err != nil {
		out <- StreamChunk{Done: true, Err: fmt.Errorf("failed to read ollama response stream: %w", err)}
		return
	}

	// Stream ended without an explicit done:true line; treat as a clean completion.
	out <- StreamChunk{Done: true}
}

type ollamaTagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

// HealthCheck verifies Ollama is reachable via GET /api/tags.
//
// Ollama itself has no notion of invalid credentials when accessed directly, so this
// never returns HealthStatusAuthInvalid unless a fronting reverse proxy rejects the
// request with 401/403.
func (p *OllamaProvider) HealthCheck(ctx context.Context) HealthResult {
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	endpoint := strings.TrimRight(p.baseURL, "/") + "/api/tags"
	httpReq, err := http.NewRequestWithContext(checkCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return HealthResult{Status: HealthStatusUnknown, Detail: fmt.Sprintf("failed to construct health check request: %v", err)}
	}
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return HealthResult{Status: HealthStatusUnreachable, Detail: err.Error()}
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return HealthResult{Status: HealthStatusAuthInvalid, Detail: fmt.Sprintf("ollama endpoint rejected the request with status %d", resp.StatusCode)}
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		var tags ollamaTagsResponse
		if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
			return HealthResult{Status: HealthStatusUnknown, Detail: fmt.Sprintf("received success status but failed to parse response: %v", err)}
		}
		return HealthResult{Status: HealthStatusOK}
	default:
		return HealthResult{Status: HealthStatusUnknown, Detail: fmt.Sprintf("unexpected status %d from ollama /api/tags", resp.StatusCode)}
	}
}

func toOllamaMessages(messages []Message) []ollamaChatMessage {
	out := make([]ollamaChatMessage, 0, len(messages))
	for _, m := range messages {
		msg := ollamaChatMessage{
			Role:    string(m.Role),
			Content: m.Content,
		}
		// Replay the assistant's own tool-call turn so the model has context for its
		// prior request in this otherwise-stateless round; Ollama has no notion of a
		// tool_call_id, so only the function name/arguments are echoed back.
		if m.Role == RoleAssistant && len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]ollamaToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, ollamaToolCall{
					Function: ollamaToolCallFunction{Name: tc.ToolName, Arguments: tc.Arguments},
				})
			}
		}
		out = append(out, msg)
	}
	return out
}

func toOllamaTools(tools []ToolDefinition) []ollamaTool {
	if len(tools) == 0 {
		return nil
	}
	out := make([]ollamaTool, 0, len(tools))
	for _, t := range tools {
		out = append(out, ollamaTool{
			Type: "function",
			Function: ollamaToolFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}
	return out
}
