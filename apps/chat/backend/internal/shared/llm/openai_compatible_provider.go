package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAICompatibleProvider talks to any LLM backend implementing the widely-adopted
// OpenAI Chat Completions wire format (OpenAI itself, and many self-hosted/proxy
// servers such as LiteLLM, vLLM, LocalAI, OpenRouter, ...).
type OpenAICompatibleProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewOpenAICompatibleProvider constructs a Provider backed by an OpenAI-compatible
// /v1/chat/completions endpoint. apiKey may be empty for backends that need no auth.
func NewOpenAICompatibleProvider(baseURL, model, apiKey string) *OpenAICompatibleProvider {
	return &OpenAICompatibleProvider{
		baseURL:    baseURL,
		model:      model,
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// Name identifies this provider implementation.
func (p *OpenAICompatibleProvider) Name() string {
	return "openai_compatible"
}

type openAIChatMessage struct {
	Role       string           `json:"role"`
	Content    string           `json:"content"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
}

type openAIToolCall struct {
	ID       string                 `json:"id,omitempty"`
	Type     string                 `json:"type,omitempty"`
	Function openAIToolCallFunction `json:"function"`
}

type openAIToolCallFunction struct {
	Name string `json:"name,omitempty"`
	// Arguments is a JSON-encoded string per the OpenAI wire format (not a nested object).
	Arguments string `json:"arguments,omitempty"`
}

type openAITool struct {
	Type     string             `json:"type"`
	Function openAIToolFunction `json:"function"`
}

type openAIToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type openAIStreamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type openAIChatRequest struct {
	Model         string               `json:"model"`
	Messages      []openAIChatMessage  `json:"messages"`
	Tools         []openAITool         `json:"tools,omitempty"`
	Stream        bool                 `json:"stream"`
	StreamOptions *openAIStreamOptions `json:"stream_options,omitempty"`
}

type openAIStreamToolCallFunctionDelta struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openAIStreamToolCallDelta struct {
	Index    int                               `json:"index"`
	ID       string                            `json:"id"`
	Function openAIStreamToolCallFunctionDelta `json:"function"`
}

type openAIStreamDelta struct {
	Content   string                      `json:"content"`
	ToolCalls []openAIStreamToolCallDelta `json:"tool_calls"`
}

type openAIStreamChoice struct {
	Delta        openAIStreamDelta `json:"delta"`
	FinishReason *string           `json:"finish_reason"`
}

type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type openAIStreamChunk struct {
	Choices []openAIStreamChoice `json:"choices"`
	Usage   *openAIUsage         `json:"usage"`
}

// ChatStream sends a chat request to an OpenAI-compatible /v1/chat/completions
// endpoint and streams back incremental chunks.
func (p *OpenAICompatibleProvider) ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	body := openAIChatRequest{
		Model:         p.model,
		Messages:      toOpenAIMessages(req.Messages),
		Tools:         toOpenAITools(req.Tools),
		Stream:        true,
		StreamOptions: &openAIStreamOptions{IncludeUsage: true},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal openai-compatible chat request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to construct openai-compatible chat request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach openai-compatible server: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("openai-compatible chat request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	out := make(chan StreamChunk)
	go p.streamResponse(resp.Body, out)
	return out, nil
}

// pendingToolCall accumulates a single tool call's streamed fragments (the id and
// function name arrive once, in the first delta for that index; arguments arrive as
// successive JSON-string fragments that must be concatenated before parsing).
type pendingToolCall struct {
	id        string
	name      string
	arguments strings.Builder
}

// streamResponse reads Server-Sent Events frames from an OpenAI-compatible endpoint
// and converts them into StreamChunk values, closing the channel once the stream
// (terminated by a "data: [DONE]" frame or EOF) is exhausted.
func (p *OpenAICompatibleProvider) streamResponse(body io.ReadCloser, out chan<- StreamChunk) {
	defer close(out)
	defer body.Close()

	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	pending := make(map[int]*pendingToolCall)
	var order []int
	var usage *Usage

	flushToolCalls := func() {
		for _, idx := range order {
			tc := pending[idx]
			id := tc.id
			if id == "" {
				id = fmt.Sprintf("call_%d", idx)
			}

			var args map[string]any
			if tc.arguments.Len() > 0 {
				if err := json.Unmarshal([]byte(tc.arguments.String()), &args); err != nil {
					args = map[string]any{}
				}
			}

			out <- StreamChunk{ToolCall: &ToolCallRequest{ID: id, ToolName: tc.name, Arguments: args}}
		}
		pending = make(map[int]*pendingToolCall)
		order = nil
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}

		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			if len(pending) > 0 {
				flushToolCalls()
			}
			out <- StreamChunk{Done: true, Usage: usage}
			return
		}

		var chunk openAIStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			out <- StreamChunk{Done: true, Err: fmt.Errorf("failed to parse openai-compatible stream chunk: %w", err)}
			return
		}

		if chunk.Usage != nil {
			usage = &Usage{
				PromptTokens:     chunk.Usage.PromptTokens,
				CompletionTokens: chunk.Usage.CompletionTokens,
				TotalTokens:      chunk.Usage.TotalTokens,
			}
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		choice := chunk.Choices[0]

		if choice.Delta.Content != "" {
			out <- StreamChunk{DeltaText: choice.Delta.Content}
		}

		for _, tcDelta := range choice.Delta.ToolCalls {
			tc, ok := pending[tcDelta.Index]
			if !ok {
				tc = &pendingToolCall{}
				pending[tcDelta.Index] = tc
				order = append(order, tcDelta.Index)
			}
			if tcDelta.ID != "" {
				tc.id = tcDelta.ID
			}
			if tcDelta.Function.Name != "" {
				tc.name = tcDelta.Function.Name
			}
			if tcDelta.Function.Arguments != "" {
				tc.arguments.WriteString(tcDelta.Function.Arguments)
			}
		}

		if choice.FinishReason != nil && *choice.FinishReason == "tool_calls" && len(pending) > 0 {
			flushToolCalls()
		}
	}

	if err := scanner.Err(); err != nil {
		out <- StreamChunk{Done: true, Err: fmt.Errorf("failed to read openai-compatible response stream: %w", err)}
		return
	}

	// Some OpenAI-compatible servers close the connection after the final chunk
	// instead of sending an explicit "data: [DONE]" frame.
	if len(pending) > 0 {
		flushToolCalls()
	}
	out <- StreamChunk{Done: true, Usage: usage}
}

type openAIModelsResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// HealthCheck verifies the endpoint is reachable via GET /v1/models, distinguishing
// an unreachable endpoint from one that rejects the configured API key.
func (p *OpenAICompatibleProvider) HealthCheck(ctx context.Context) HealthResult {
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(checkCtx, http.MethodGet, p.baseURL+"/v1/models", nil)
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
		return HealthResult{Status: HealthStatusAuthInvalid, Detail: fmt.Sprintf("endpoint rejected the request with status %d", resp.StatusCode)}
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		var models openAIModelsResponse
		if err := json.NewDecoder(resp.Body).Decode(&models); err != nil {
			return HealthResult{Status: HealthStatusUnknown, Detail: fmt.Sprintf("received success status but failed to parse response: %v", err)}
		}
		return HealthResult{Status: HealthStatusOK}
	default:
		return HealthResult{Status: HealthStatusUnknown, Detail: fmt.Sprintf("unexpected status %d from /v1/models", resp.StatusCode)}
	}
}

func toOpenAIMessages(messages []Message) []openAIChatMessage {
	out := make([]openAIChatMessage, 0, len(messages))
	for _, m := range messages {
		msg := openAIChatMessage{
			Role:       string(m.Role),
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
		if m.Role == RoleAssistant && len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]openAIToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				argsJSON, err := json.Marshal(tc.Arguments)
				if err != nil {
					argsJSON = []byte("{}")
				}
				msg.ToolCalls = append(msg.ToolCalls, openAIToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: openAIToolCallFunction{
						Name:      tc.ToolName,
						Arguments: string(argsJSON),
					},
				})
			}
		}
		out = append(out, msg)
	}
	return out
}

func toOpenAITools(tools []ToolDefinition) []openAITool {
	if len(tools) == 0 {
		return nil
	}
	out := make([]openAITool, 0, len(tools))
	for _, t := range tools {
		out = append(out, openAITool{
			Type: "function",
			Function: openAIToolFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}
	return out
}
