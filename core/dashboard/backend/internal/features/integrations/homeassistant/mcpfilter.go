package homeassistant

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
)

// errMalformedMCP means a JSON-RPC message could not be read, so the proxy
// cannot tell whether it is allowed and fails closed.
var errMalformedMCP = errors.New("malformed mcp message")

// rpcControlDenied is the JSON-RPC error code of a blocked control tool call.
const rpcControlDenied = -32001

// IsReadOnlyTool reports whether a Home Assistant MCP tool only reads state.
// Home Assistant names its read tools GetLiveContext, GetDateTime,
// HassGetState, todo_get_items, calendar_get_events and the like; every other
// tool (HassTurnOn, HassLightSet, ...) may change a device. The decision is
// by name only, so tools/list and tools/call always agree, and an unknown tool
// counts as control (fail closed).
func IsReadOnlyTool(name string) bool {
	return strings.HasPrefix(name, "Get") ||
		strings.HasPrefix(name, "HassGet") ||
		strings.HasPrefix(name, "get_") ||
		strings.Contains(name, "_get_")
}

type rpcRequest struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method"`
	Params struct {
		Name string `json:"name"`
	} `json:"params"`
}

// splitMessages returns the messages of a single JSON-RPC message or a batch.
func splitMessages(body []byte) ([]json.RawMessage, bool, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var batch []json.RawMessage
		if err := json.Unmarshal(trimmed, &batch); err != nil {
			return nil, true, errMalformedMCP
		}
		return batch, true, nil
	}
	if !json.Valid(trimmed) {
		return nil, false, errMalformedMCP
	}
	return []json.RawMessage{trimmed}, false, nil
}

// blockedCalls returns a JSON-RPC error for every tools/call of a control tool
// in body. A non-empty result means the request must not be forwarded.
func blockedCalls(body []byte) ([]map[string]any, error) {
	msgs, _, err := splitMessages(body)
	if err != nil {
		return nil, err
	}
	var denied []map[string]any
	for _, raw := range msgs {
		var req rpcRequest
		if err := json.Unmarshal(raw, &req); err != nil {
			return nil, errMalformedMCP
		}
		if req.Method != "tools/call" || IsReadOnlyTool(req.Params.Name) {
			continue
		}
		var id any
		if len(req.ID) > 0 {
			id = req.ID
		}
		denied = append(denied, map[string]any{
			"jsonrpc": "2.0",
			"id":      id,
			"error": map[string]any{
				"code":    rpcControlDenied,
				"message": "this household allows only read-only Home Assistant tools",
			},
		})
	}
	return denied, nil
}

// filterToolLists removes control tools from every tools/list result in a
// JSON body (a single message or a batch). Other messages pass unchanged.
func filterToolLists(body []byte) ([]byte, error) {
	msgs, batch, err := splitMessages(body)
	if err != nil {
		return nil, err
	}
	for i, raw := range msgs {
		filtered, err := filterMessage(raw)
		if err != nil {
			return nil, err
		}
		msgs[i] = filtered
	}
	if batch {
		return json.Marshal(msgs)
	}
	return msgs[0], nil
}

// filterMessage filters one message whose result carries a tools array.
func filterMessage(raw json.RawMessage) (json.RawMessage, error) {
	var msg map[string]json.RawMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		return nil, errMalformedMCP
	}
	var result map[string]json.RawMessage
	if err := json.Unmarshal(msg["result"], &result); err != nil || result["tools"] == nil {
		return raw, nil
	}
	var tools []json.RawMessage
	if err := json.Unmarshal(result["tools"], &tools); err != nil {
		return nil, errMalformedMCP
	}
	kept := make([]json.RawMessage, 0, len(tools))
	for _, tool := range tools {
		var t struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(tool, &t); err != nil {
			return nil, errMalformedMCP
		}
		if IsReadOnlyTool(t.Name) {
			kept = append(kept, tool)
		}
	}
	var err error
	if result["tools"], err = json.Marshal(kept); err != nil {
		return nil, err
	}
	if msg["result"], err = json.Marshal(result); err != nil {
		return nil, err
	}
	return json.Marshal(msg)
}

// filterEventStream applies filterMessage to every "data:" line of a
// text/event-stream body.
func filterEventStream(body []byte) ([]byte, error) {
	lines := bytes.Split(body, []byte("\n"))
	for i, line := range lines {
		payload, ok := bytes.CutPrefix(bytes.TrimRight(line, "\r"), []byte("data:"))
		if !ok || len(bytes.TrimSpace(payload)) == 0 {
			continue
		}
		filtered, err := filterToolLists(payload)
		if err != nil {
			return nil, err
		}
		lines[i] = append([]byte("data: "), filtered...)
	}
	return bytes.Join(lines, []byte("\n")), nil
}
