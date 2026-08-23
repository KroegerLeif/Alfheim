package mcp

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
	"sync"
	"sync/atomic"
	"time"
)

// toolsCacheTTL bounds how long a successful ListTools result is reused before the
// next call re-queries the MCP server, per the caching requirement for tool discovery.
const toolsCacheTTL = 60 * time.Second

// Client is a minimal MCP Streamable HTTP client for a single MCP server endpoint
// (e.g. http://pantry-backend:8000/mcp). It is safe for concurrent use.
type Client struct {
	endpointURL string
	httpClient  *http.Client

	nextID int64

	mu            sync.Mutex
	sessionID     string
	negotiatedVer string
	initialized   bool
	cachedTools   []Tool
	cachedToolsAt time.Time
}

// NewClient constructs a Client for a single MCP server's Streamable HTTP endpoint.
func NewClient(endpointURL string) *Client {
	return &Client{
		endpointURL: endpointURL,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// ListTools returns the MCP server's available tools, performing the initialize
// handshake on first use and caching the result for toolsCacheTTL to avoid
// re-querying on every single chat turn.
func (c *Client) ListTools(ctx context.Context) ([]Tool, error) {
	c.mu.Lock()
	if c.initialized && time.Since(c.cachedToolsAt) < toolsCacheTTL {
		tools := c.cachedTools
		c.mu.Unlock()
		return tools, nil
	}
	c.mu.Unlock()

	if err := c.ensureInitialized(ctx); err != nil {
		return nil, err
	}

	msg, err := c.call(ctx, "tools/list", map[string]any{})
	if err != nil {
		return nil, fmt.Errorf("failed to list tools from %s: %w", c.endpointURL, err)
	}

	var result listToolsResult
	if err := json.Unmarshal(msg.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse tools/list result from %s: %w", c.endpointURL, err)
	}

	c.mu.Lock()
	c.cachedTools = result.Tools
	c.cachedToolsAt = time.Now()
	c.mu.Unlock()

	return result.Tools, nil
}

// CallTool invokes a single tool and returns its result as plain text (concatenating
// every text content block in the response), along with whether the server flagged
// the result as an error (isError) — which is fed back to the model as-is, not
// treated as a Go error, since a tool error is a normal, recoverable model input.
func (c *Client) CallTool(ctx context.Context, toolName string, arguments map[string]any) (string, bool, error) {
	if err := c.ensureInitialized(ctx); err != nil {
		return "", false, err
	}

	msg, err := c.call(ctx, "tools/call", callToolParams{Name: toolName, Arguments: arguments})
	if err != nil {
		return "", false, fmt.Errorf("failed to call tool %q on %s: %w", toolName, c.endpointURL, err)
	}

	var result callToolResult
	if err := json.Unmarshal(msg.Result, &result); err != nil {
		return "", false, fmt.Errorf("failed to parse tools/call result for %q from %s: %w", toolName, c.endpointURL, err)
	}

	var text strings.Builder
	for _, block := range result.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}

	return text.String(), result.IsError, nil
}

// ensureInitialized performs the MCP "initialize" handshake exactly once per Client
// instance (subsequent calls are no-ops), capturing the session id and negotiated
// protocol version required on every following request.
func (c *Client) ensureInitialized(ctx context.Context) error {
	c.mu.Lock()
	if c.initialized {
		c.mu.Unlock()
		return nil
	}
	c.mu.Unlock()

	msg, err := c.call(ctx, "initialize", initializeParams{
		ProtocolVersion: protocolVersion,
		Capabilities:    map[string]any{},
		ClientInfo:      implementationInfo{Name: "alfheim-chat-backend", Version: "0.1.0"},
	})
	if err != nil {
		return fmt.Errorf("failed to initialize mcp session with %s: %w", c.endpointURL, err)
	}

	var result initializeResult
	if err := json.Unmarshal(msg.Result, &result); err != nil {
		return fmt.Errorf("failed to parse initialize result from %s: %w", c.endpointURL, err)
	}

	c.mu.Lock()
	c.negotiatedVer = result.ProtocolVersion
	c.mu.Unlock()

	// The "initialized" notification carries no id and expects no response body.
	if err := c.notify(ctx, "notifications/initialized", nil); err != nil {
		return fmt.Errorf("failed to send initialized notification to %s: %w", c.endpointURL, err)
	}

	c.mu.Lock()
	c.initialized = true
	c.mu.Unlock()
	return nil
}

// call sends a JSON-RPC request and returns its response message.
func (c *Client) call(ctx context.Context, method string, params any) (*jsonRPCMessage, error) {
	id := atomic.AddInt64(&c.nextID, 1)
	msg, err := c.send(ctx, &id, method, params)
	if err != nil {
		return nil, err
	}
	if msg == nil {
		return nil, fmt.Errorf("mcp server returned no response for request %q", method)
	}
	if msg.Error != nil {
		return nil, fmt.Errorf("mcp error %d: %s", msg.Error.Code, msg.Error.Message)
	}
	return msg, nil
}

// notify sends a JSON-RPC notification (no id, no response expected).
func (c *Client) notify(ctx context.Context, method string, params any) error {
	_, err := c.send(ctx, nil, method, params)
	return err
}

// send performs a single JSON-RPC POST against the MCP endpoint, handling both plain
// JSON and text/event-stream response bodies, and updates the session id from the
// response headers if present.
func (c *Client) send(ctx context.Context, id *int64, method string, params any) (*jsonRPCMessage, error) {
	reqBody := jsonRPCRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params}
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal mcp request %q: %w", method, err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpointURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to construct mcp request %q: %w", method, err)
	}
	httpReq.Header.Set(headerContentType, contentTypeJSON)
	httpReq.Header.Set(headerAccept, contentTypeJSON+", "+contentTypeSSE)

	c.mu.Lock()
	sessionID := c.sessionID
	negotiatedVer := c.negotiatedVer
	c.mu.Unlock()
	if sessionID != "" {
		httpReq.Header.Set(headerSessionID, sessionID)
	}
	if negotiatedVer != "" {
		httpReq.Header.Set(headerProtocolVersion, negotiatedVer)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach mcp server for %q: %w", method, err)
	}
	defer resp.Body.Close()

	if newSessionID := resp.Header.Get(headerSessionID); newSessionID != "" {
		c.mu.Lock()
		c.sessionID = newSessionID
		c.mu.Unlock()
	}

	if resp.StatusCode == http.StatusAccepted {
		// Notifications (and some servers, for any message) may be acknowledged with
		// 202 and no body; there is nothing further to parse.
		return nil, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("mcp server responded with status %d for %q: %s", resp.StatusCode, method, string(body))
	}

	contentType := resp.Header.Get(headerContentType)
	switch {
	case strings.Contains(contentType, contentTypeJSON):
		var msg jsonRPCMessage
		if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
			return nil, fmt.Errorf("failed to decode mcp json response for %q: %w", method, err)
		}
		return &msg, nil
	case strings.Contains(contentType, contentTypeSSE):
		return readSSEJSONRPCMessage(resp.Body)
	default:
		// A notification's 200/204 response with no meaningful body is fine.
		if id == nil {
			return nil, nil
		}
		return nil, fmt.Errorf("unexpected content-type %q from mcp server for %q", contentType, method)
	}
}

// readSSEJSONRPCMessage reads Server-Sent Events frames until it finds one whose
// "data:" payload parses as a JSON-RPC message, then returns it without waiting for
// the server to close the connection.
func readSSEJSONRPCMessage(body io.Reader) (*jsonRPCMessage, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var dataLines []string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if len(dataLines) == 0 {
				continue
			}
			data := strings.Join(dataLines, "\n")
			dataLines = nil

			var msg jsonRPCMessage
			if err := json.Unmarshal([]byte(data), &msg); err != nil {
				continue // Ignore frames that aren't a JSON-RPC message (e.g. keepalive comments).
			}
			return &msg, nil
		}
		if after, ok := strings.CutPrefix(line, "data:"); ok {
			dataLines = append(dataLines, strings.TrimPrefix(after, " "))
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read mcp sse stream: %w", err)
	}
	return nil, errors.New("mcp sse stream ended without a JSON-RPC message")
}
