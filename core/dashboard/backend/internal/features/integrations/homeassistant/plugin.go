// Package homeassistant is the Home Assistant plugin of the dashboard (#957,
// #960, ADR 0010): the health check, the pinned entity states, the MCP proxy
// that lets ALFI reach Home Assistant's MCP server without ever seeing the
// token, and the signed inbound webhook that triggers Alfheim actions.
//
// The long-lived access token stays in the plugin's encrypted credentials. It
// is sent only to the household's own Home Assistant, through the netguard
// client, and never appears in a response, a log line or a health detail.
package homeassistant

import (
	"context"
	"net/http"
	"regexp"
	"strings"

	"alfheim/dashboard/internal/features/plugins"
)

// Type is the plugin type and the {type} segment of the plugin API.
const Type = "homeassistant"

// CredentialToken is the credential name of the long-lived access token.
const CredentialToken = "token"

// MaxPinnedEntities caps the pinned entities of one household.
const MaxPinnedEntities = 50

// entityIDPattern is Home Assistant's "<domain>.<object_id>" entity id.
var entityIDPattern = regexp.MustCompile(`^[a-z0-9_]+\.[a-z0-9_]+$`)

// maxEntityIDLength bounds one pinned entity id.
const maxEntityIDLength = 255

// Settings is the non-secret configuration of the plugin.
type Settings struct {
	// PinnedEntities are the entities whose states the dashboard reads.
	PinnedEntities []string `json:"pinned_entities"`
	// AllowControl lets ALFI call Home Assistant tools that change devices.
	// False (the default) limits the MCP proxy to read-only tools.
	AllowControl bool `json:"allow_control"`
}

// Binder creates and removes the household's service binding (#958) when the
// plugin is switched on or off, so webhook actions can run as the household's
// service principal.
type Binder interface {
	Bind(ctx context.Context, change plugins.EnableChange) error
	Unbind(ctx context.Context, change plugins.EnableChange) error
}

// Plugin implements plugins.Plugin and plugins.EnableObserver.
type Plugin struct {
	client *http.Client
	binder Binder
}

// NewPlugin returns the plugin. client is the netguard client from
// plugins.NewHTTPClient; binder is nil when the installation has no service
// principal configured, in which case webhook actions cannot run.
func NewPlugin(client *http.Client, binder Binder) *Plugin {
	return &Plugin{client: client, binder: binder}
}

// Type returns "homeassistant".
func (p *Plugin) Type() string { return Type }

// ValidateConfig requires a base URL and well-formed, unique pinned entities.
func (p *Plugin) ValidateConfig(cfg plugins.Config) error {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return plugins.NewValidationError("base_url", "base_url is required")
	}
	settings, err := decodeSettings(cfg)
	if err != nil {
		return plugins.NewValidationError("config", "config has unknown or malformed fields")
	}
	if len(settings.PinnedEntities) > MaxPinnedEntities {
		return plugins.NewValidationError("config.pinned_entities", "too many pinned entities")
	}
	seen := make(map[string]bool, len(settings.PinnedEntities))
	for _, id := range settings.PinnedEntities {
		if len(id) > maxEntityIDLength || !entityIDPattern.MatchString(id) {
			return plugins.NewValidationError("config.pinned_entities", "entity ids look like light.kitchen")
		}
		if seen[id] {
			return plugins.NewValidationError("config.pinned_entities", "entity ids must be unique")
		}
		seen[id] = true
	}
	return nil
}

// HealthCheck calls GET {base}/api/, which answers {"message": "API running."}.
func (p *Plugin) HealthCheck(ctx context.Context, cfg plugins.Config, creds plugins.Credentials) plugins.Health {
	token := creds[CredentialToken]
	if token == "" {
		return plugins.Health{Status: plugins.StatusInvalidConfig, Detail: "no access token is stored"}
	}
	var body struct {
		Message string `json:"message"`
	}
	status, err := getJSON(ctx, p.client, cfg.BaseURL, "/api/", token, &body)
	switch {
	case err != nil && status == 0:
		return plugins.HealthFromError(err)
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return plugins.Health{Status: plugins.StatusAuthFailed, Detail: "Home Assistant rejected the access token"}
	case err != nil || body.Message != "API running.":
		return plugins.Health{Status: plugins.StatusInvalidResponse, Detail: "the address did not answer like the Home Assistant API"}
	}
	return plugins.Health{Status: plugins.StatusOK, Detail: "Home Assistant API is running"}
}

// PluginEnabledChanged binds the household's service principal when the
// plugin is switched on and removes the binding when it is switched off.
func (p *Plugin) PluginEnabledChanged(ctx context.Context, change plugins.EnableChange) error {
	if p.binder == nil {
		return nil
	}
	if change.Enabled {
		return p.binder.Bind(ctx, change)
	}
	return p.binder.Unbind(ctx, change)
}

// decodeSettings reads Settings strictly.
func decodeSettings(cfg plugins.Config) (Settings, error) {
	var s Settings
	if err := cfg.Decode(&s); err != nil {
		return Settings{}, err
	}
	return s, nil
}
