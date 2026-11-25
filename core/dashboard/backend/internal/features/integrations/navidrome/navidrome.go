// Package navidrome is the Navidrome media server plugin (#961), built on the
// Subsonic API: every request is signed with token authentication, health is
// ping.view and now playing is getNowPlaying.view. Subsonic has no remote
// control, so the plugin is read-only. Media itself is never proxied.
package navidrome

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
)

// Type is the plugin type and the {type} path segment of the API.
const Type = "navidrome"

// Credential names. Both are stored encrypted by the plugin framework.
const (
	CredentialUsername = "username"
	CredentialPassword = "password"
)

// saltBytes is the length of the random salt before hex encoding.
const saltBytes = 12

// SaltFunc returns a fresh salt for one signed request.
type SaltFunc func() (string, error)

// Plugin talks to one household's Navidrome server.
type Plugin struct {
	client *http.Client
	salt   SaltFunc
}

// Option customises the plugin.
type Option func(*Plugin)

// WithSalt replaces the random salt source; tests use a fixed salt to check
// the token signature.
func WithSalt(salt SaltFunc) Option {
	return func(p *Plugin) { p.salt = salt }
}

// New returns the plugin. client is the netguard client from
// plugins.NewHTTPClient; tests pass the client of an httptest server.
func New(client *http.Client, opts ...Option) *Plugin {
	p := &Plugin{client: client, salt: randomSalt}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

// randomSalt returns 12 random bytes, hex encoded.
func randomSalt() (string, error) {
	b := make([]byte, saltBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate subsonic salt: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// Type returns "navidrome".
func (p *Plugin) Type() string { return Type }

// settings is empty: Navidrome needs only the base URL and the credentials.
type settings struct{}

// ValidateConfig requires a base URL and rejects any setting.
func (p *Plugin) ValidateConfig(cfg plugins.Config) error {
	if cfg.BaseURL == "" {
		return plugins.NewValidationError("base_url", "base_url is required")
	}
	var s settings
	if err := cfg.Decode(&s); err != nil {
		return plugins.NewValidationError("config", "navidrome takes no settings")
	}
	return nil
}

// HealthCheck calls ping.view with a signed request.
func (p *Plugin) HealthCheck(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) plugins.Health {
	env, err := p.call(ctx, cfg, creds, "ping.view")
	switch {
	case err == nil:
		detail := "Subsonic API " + env.Version
		if env.ServerVersion != "" {
			detail = "Navidrome " + env.ServerVersion
		}
		return plugins.Health{Status: plugins.StatusOK, Detail: detail}
	case errors.Is(err, media.ErrMissingCredentials):
		return plugins.Health{Status: plugins.StatusInvalidConfig, Detail: "no user name and password are stored"}
	case errors.Is(err, media.ErrAuthFailed):
		return plugins.Health{Status: plugins.StatusAuthFailed, Detail: "Navidrome rejected the user name or password"}
	case errors.Is(err, media.ErrUpstream):
		return plugins.Health{Status: plugins.StatusInvalidResponse, Detail: "the server did not answer like a Subsonic server"}
	default:
		return plugins.HealthFromError(err)
	}
}

// nowPlayingEntry is one entry of getNowPlaying.view.
type nowPlayingEntry struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Artist     string `json:"artist"`
	Username   string `json:"username"`
	PlayerID   int    `json:"playerId"`
	PlayerName string `json:"playerName"`
}

// NowPlaying lists what the server's players report as playing. Subsonic
// cannot control a player, so CanControl is always false.
func (p *Plugin) NowPlaying(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) ([]media.Status, error) {
	env, err := p.call(ctx, cfg, creds, "getNowPlaying.view")
	if err != nil {
		return nil, err
	}
	entries := []nowPlayingEntry{}
	if env.NowPlaying != nil {
		entries = env.NowPlaying.Entry
	}
	out := make([]media.Status, 0, len(entries))
	for _, e := range entries {
		device := e.PlayerName
		if device == "" {
			device = e.Username
		}
		id := e.ID
		if e.PlayerID > 0 {
			id = fmt.Sprintf("%d", e.PlayerID)
		}
		out = append(out, media.Status{
			Source: Type, SessionID: id, Title: e.Title, Artist: e.Artist,
			Device: device, State: media.StatePlaying, CanControl: false,
		})
	}
	return out, nil
}
