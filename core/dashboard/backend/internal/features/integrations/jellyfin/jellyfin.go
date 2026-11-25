// Package jellyfin is the Jellyfin media server plugin (#961): health from
// GET /System/Info, now playing from GET /Sessions and remote control through
// POST /Sessions/{id}/Playing/{command}, all authenticated with an API key.
// Media itself is never proxied.
package jellyfin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
)

// Type is the plugin type and the {type} path segment of the API.
const Type = "jellyfin"

// CredentialAPIKey is the credential name of the Jellyfin API key.
const CredentialAPIKey = "api_key"

// maxBodyBytes bounds every response body read from the server.
const maxBodyBytes = 1 << 20

// Plugin talks to one household's Jellyfin server.
type Plugin struct {
	client *http.Client
}

// New returns the plugin. client is the netguard client from
// plugins.NewHTTPClient; tests pass the client of an httptest server.
func New(client *http.Client) *Plugin {
	return &Plugin{client: client}
}

// Type returns "jellyfin".
func (p *Plugin) Type() string { return Type }

// settings is empty: Jellyfin needs only the base URL and the API key. Strict
// decoding still rejects unknown fields.
type settings struct{}

// ValidateConfig requires a base URL and rejects any setting.
func (p *Plugin) ValidateConfig(cfg plugins.Config) error {
	if cfg.BaseURL == "" {
		return plugins.NewValidationError("base_url", "base_url is required")
	}
	var s settings
	if err := cfg.Decode(&s); err != nil {
		return plugins.NewValidationError("config", "jellyfin takes no settings")
	}
	return nil
}

// systemInfo is the part of GET /System/Info the health check reads.
type systemInfo struct {
	Version    string `json:"Version"`
	ServerName string `json:"ServerName"`
}

// HealthCheck calls GET /System/Info with the API key.
func (p *Plugin) HealthCheck(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) plugins.Health {
	var info systemInfo
	err := p.getJSON(ctx, cfg, creds, "/System/Info", nil, &info)
	switch {
	case err == nil && info.Version != "":
		return plugins.Health{Status: plugins.StatusOK, Detail: "Jellyfin " + info.Version}
	case err == nil:
		return plugins.Health{Status: plugins.StatusInvalidResponse, Detail: "the server did not report a Jellyfin version"}
	case errors.Is(err, media.ErrMissingCredentials):
		return plugins.Health{Status: plugins.StatusInvalidConfig, Detail: "no API key is stored"}
	case errors.Is(err, media.ErrAuthFailed):
		return plugins.Health{Status: plugins.StatusAuthFailed, Detail: "Jellyfin rejected the API key"}
	case errors.Is(err, media.ErrUpstream):
		return plugins.Health{Status: plugins.StatusInvalidResponse, Detail: "the server did not answer like Jellyfin"}
	default:
		return plugins.HealthFromError(err)
	}
}

// newRequest builds an authenticated request to path below the base URL.
func (p *Plugin) newRequest(ctx context.Context, method string, cfg plugins.Config, creds plugins.Credentials, path string, query url.Values) (*http.Request, error) {
	key := creds[CredentialAPIKey]
	if key == "" {
		return nil, media.ErrMissingCredentials
	}
	if strings.ContainsAny(key, "\"\r\n") {
		return nil, fmt.Errorf("%w: the API key contains invalid characters", media.ErrAuthFailed)
	}
	target, err := url.Parse(strings.TrimRight(cfg.BaseURL, "/") + path)
	if err != nil {
		return nil, fmt.Errorf("build jellyfin url: %w", err)
	}
	target.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, method, target.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("build jellyfin request: %w", err)
	}
	req.Header.Set("Authorization", `MediaBrowser Token="`+key+`"`)
	req.Header.Set("Accept", "application/json")
	return req, nil
}

// do sends req and maps the status code to the media errors.
func (p *Plugin) do(req *http.Request) (*http.Response, error) {
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jellyfin request: %w", err)
	}
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return resp, nil
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		err = media.ErrAuthFailed
	case resp.StatusCode == http.StatusNotFound:
		err = media.ErrSessionNotFound
	default:
		err = fmt.Errorf("%w: status %d", media.ErrUpstream, resp.StatusCode)
	}
	drain(resp)
	return nil, err
}

// getJSON sends an authenticated GET and decodes the JSON answer into v. A
// 404 on a read means the address is not a Jellyfin server.
func (p *Plugin) getJSON(ctx context.Context, cfg plugins.Config, creds plugins.Credentials, path string, query url.Values, v any) error {
	req, err := p.newRequest(ctx, http.MethodGet, cfg, creds, path, query)
	if err != nil {
		return err
	}
	resp, err := p.do(req)
	if errors.Is(err, media.ErrSessionNotFound) {
		return fmt.Errorf("%w: %s not found", media.ErrUpstream, path)
	}
	if err != nil {
		return err
	}
	defer drain(resp)
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBodyBytes)).Decode(v); err != nil {
		return fmt.Errorf("%w: invalid JSON", media.ErrUpstream)
	}
	return nil
}

// drain discards the rest of the body and closes it, so the connection can be
// reused. A failure only costs the connection, so it is not reported.
func drain(resp *http.Response) {
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxBodyBytes))
	_ = resp.Body.Close()
}
