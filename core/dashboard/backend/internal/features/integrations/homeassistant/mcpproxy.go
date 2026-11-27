package homeassistant

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"alfheim/dashboard/internal/features/plugins"
	"alfheim/go-shared/netguard"
)

// MCP proxy limits.
const (
	// MCPTimeout bounds one forwarded MCP request: longer than a health
	// check for tool calls, shorter than the server's 15 s write timeout.
	MCPTimeout      = 12 * time.Second
	maxMCPRequest   = 1 << 20
	maxMCPResponse  = 4 << 20
	headerSessionID = "Mcp-Session-Id"
	headerProtocol  = "Mcp-Protocol-Version"
)

// MCPProxy forwards Streamable HTTP MCP traffic of household members to the
// household's Home Assistant at {base}/api/mcp, adding the stored token. With
// allow_control off it answers tools/call for control tools itself and removes
// them from tools/list. Chat calls it with the user's token and X-Household-ID.
type MCPProxy struct {
	access PluginAccess
	client *http.Client
	log    *slog.Logger
}

// NewMCPProxy returns the proxy; client is a netguard client with MCPTimeout.
func NewMCPProxy(access PluginAccess, client *http.Client, log *slog.Logger) *MCPProxy {
	return &MCPProxy{access: access, client: client, log: log}
}

// Post forwards one JSON-RPC message or batch.
func (p *MCPProxy) Post(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, p.log)
	if !ok {
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxMCPRequest))
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, CodeInvalidBody, "the MCP request is too large")
		return
	}
	inst, err := p.access.EnabledInstance(r.Context(), hc.HouseholdID, Type)
	if err != nil {
		writePluginErr(w, err, p.log)
		return
	}
	settings, err := decodeSettings(inst.Config)
	if err != nil {
		writePluginErr(w, err, p.log)
		return
	}
	if !settings.AllowControl {
		denied, err := blockedCalls(body)
		if err != nil {
			writeError(w, http.StatusBadRequest, CodeInvalidBody, "the request is not a JSON-RPC message")
			return
		}
		if len(denied) > 0 {
			p.log.Info("blocked a Home Assistant control tool call",
				slog.String("household_id", hc.HouseholdID.String()))
			writeDenied(w, denied, bytes.HasPrefix(bytes.TrimSpace(body), []byte("[")))
			return
		}
	}
	p.forward(w, r, inst, settings, http.MethodPost, body)
}

// Delete ends an MCP session at Home Assistant.
func (p *MCPProxy) Delete(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, p.log)
	if !ok {
		return
	}
	inst, err := p.access.EnabledInstance(r.Context(), hc.HouseholdID, Type)
	if err != nil {
		writePluginErr(w, err, p.log)
		return
	}
	p.forward(w, r, inst, Settings{AllowControl: true}, http.MethodDelete, nil)
}

// MethodNotAllowed answers GET: the proxy offers no server-initiated stream,
// which Streamable HTTP allows a server to decline with 405.
func (p *MCPProxy) MethodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Allow", "POST, DELETE")
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (p *MCPProxy) forward(w http.ResponseWriter, r *http.Request, inst plugins.Instance, settings Settings, method string, body []byte) {
	resp, err := p.send(r, inst, method, body)
	if err != nil {
		writePluginErr(w, err, p.log)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		writePluginErr(w, ErrAuthRejected, p.log)
		return
	case resp.StatusCode == http.StatusNotFound && r.Header.Get(headerSessionID) != "":
		// An expired session: the client must initialize again (Streamable HTTP).
		w.WriteHeader(http.StatusNotFound)
		return
	case resp.StatusCode >= 300:
		writePluginErr(w, ErrUpstream, p.log)
		return
	}
	out, err := io.ReadAll(io.LimitReader(resp.Body, maxMCPResponse))
	if err != nil {
		writePluginErr(w, ErrUpstream, p.log)
		return
	}
	contentType := resp.Header.Get("Content-Type")
	if !settings.AllowControl && len(out) > 0 {
		if out, err = filterBody(contentType, out); err != nil {
			writePluginErr(w, ErrUpstream, p.log)
			return
		}
	}
	for _, name := range []string{"Content-Type", headerSessionID, headerProtocol} {
		if v := resp.Header.Get(name); v != "" {
			w.Header().Set(name, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	// The status line is sent; a write failure means the client went away.
	_, _ = w.Write(out)
}

// send makes the upstream request with the stored token.
func (p *MCPProxy) send(r *http.Request, inst plugins.Instance, method string, body []byte) (*http.Response, error) {
	ctx, cancel := context.WithTimeout(r.Context(), MCPTimeout)
	req, err := http.NewRequestWithContext(ctx, method, endpoint(inst.Config.BaseURL, "/api/mcp"), bytes.NewReader(body))
	if err != nil {
		cancel()
		return nil, errors.Join(ErrUpstream, err)
	}
	req.Header.Set("Authorization", "Bearer "+inst.Credentials[CredentialToken])
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	for _, name := range []string{headerSessionID, headerProtocol} {
		if v := r.Header.Get(name); v != "" {
			req.Header.Set(name, v)
		}
	}
	resp, err := p.client.Do(req)
	if err != nil {
		cancel()
		if errors.Is(err, netguard.ErrBlocked) {
			return nil, plugins.ErrHostNotAllowed
		}
		return nil, ErrUpstream
	}
	resp.Body = cancelOnClose{ReadCloser: resp.Body, cancel: cancel}
	return resp, nil
}
