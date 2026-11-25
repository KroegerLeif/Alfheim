// Package plugins is the typed plugin framework of the dashboard (ADR 0010): the
// plugin contract, the registry of plugin types, the household-scoped storage
// with encrypted credentials, the on-demand health check and the HTTP API.
//
// A concrete plugin lives in its own package (internal/features/integrations/<type>),
// is constructed in cmd/server/main.go with its dependencies (the netguard HTTP
// client from NewHTTPClient, a logger, a clock) and is passed to NewRegistry.
// There is no global registry, no init() self-registration and no reflection.
package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
)

// Plugin is the contract every typed plugin implements.
//
// Optional capabilities (for example an MCP proxy or a media status feed) are
// separate interfaces that the feature using them declares next to its own
// code. A plugin opts in by implementing that interface; CapabilityOf finds it
// with a plain type assertion.
type Plugin interface {
	// Type is the stable identifier of the plugin, for example "homeassistant".
	// It must match TypePattern and is the {type} path segment of the API.
	Type() string
	// ValidateConfig checks the non-secret configuration before it is stored.
	// Returning a *ValidationError reports field-level problems to the client;
	// any other error is reported against the "config" field.
	ValidateConfig(cfg Config) error
	// HealthCheck tests the connection to the target. The context carries the
	// framework's timeout. Plugins make every request with the netguard client
	// they were constructed with. The detail is sanitized by the framework, but
	// plugins should still never put credentials or raw upstream bodies in it.
	HealthCheck(ctx context.Context, cfg Config, creds Credentials) Health
}

// Config is the non-secret configuration of one household's plugin. Members of
// the household can read it, so it must never hold a secret: secrets belong in
// Credentials.
type Config struct {
	// BaseURL is the target's address, empty for plugins without one.
	BaseURL string
	// Settings is the plugin-specific JSON object; Decode reads it into a struct.
	Settings json.RawMessage
}

// Decode strictly unmarshals Settings into v: unknown fields are rejected, so a
// typo in a stored setting fails validation instead of being ignored.
func (c Config) Decode(v any) error {
	raw := c.Settings
	if len(bytes.TrimSpace(raw)) == 0 {
		raw = json.RawMessage(`{}`)
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("decode plugin settings: %w", err)
	}
	return nil
}

// Credentials are the decrypted secrets of one household's plugin, keyed by a
// plugin-defined name such as "token" or "api_key". They are encrypted at rest,
// write-only through the API and never logged or echoed in a health detail.
type Credentials map[string]string

// HealthStatus is the outcome of a health check. The frontend translates each
// status; Health.Detail is supplementary operator information.
type HealthStatus string

// Health statuses. StatusUnknown means the plugin was never tested since its
// configuration last changed.
const (
	StatusUnknown                HealthStatus = "unknown"
	StatusOK                     HealthStatus = "ok"
	StatusHostNotAllowed         HealthStatus = "host_not_allowed"
	StatusUnreachable            HealthStatus = "unreachable"
	StatusTimeout                HealthStatus = "timeout"
	StatusAuthFailed             HealthStatus = "auth_failed"
	StatusInvalidResponse        HealthStatus = "invalid_response"
	StatusInvalidConfig          HealthStatus = "invalid_config"
	StatusCredentialsUnavailable HealthStatus = "credentials_unavailable"
	StatusError                  HealthStatus = "error"
)

// Health is the result of Plugin.HealthCheck.
type Health struct {
	Status HealthStatus
	// Detail is a short English explanation for operators. It never contains
	// credentials; the framework redacts them and caps the length.
	Detail string
}
