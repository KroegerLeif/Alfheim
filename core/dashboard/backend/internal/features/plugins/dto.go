package plugins

import (
	"bytes"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Request limits of PUT /api/v1/integrations/plugins/{type}.
const (
	MaxBaseURLLength     = 2048
	MaxConfigBytes       = 16 * 1024
	MaxCredentialFields  = 16
	MaxCredentialValue   = 4096
	credentialNameLength = 64
)

var credentialNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// UpdateRequest is the body of PUT /api/v1/integrations/plugins/{type}.
// Credentials is write-only: absent or null keeps the stored credentials, an
// object replaces them and an empty object removes them.
type UpdateRequest struct {
	Enabled     bool            `json:"enabled"`
	BaseURL     string          `json:"base_url"`
	Config      json.RawMessage `json:"config"`
	Credentials *Credentials    `json:"credentials"`
}

// normalize trims the base URL and turns an absent or null config into {}.
func (req *UpdateRequest) normalize() {
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	trimmed := bytes.TrimSpace(req.Config)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		req.Config = json.RawMessage(`{}`)
	}
}

// Validate checks the framework-level rules; the plugin checks its own config.
func (req *UpdateRequest) Validate() *ValidationError {
	var fields []FieldError
	if msg := validateBaseURL(req.BaseURL); msg != "" {
		fields = append(fields, FieldError{Field: "base_url", Message: msg})
	}
	if len(req.Config) > MaxConfigBytes {
		fields = append(fields, FieldError{Field: "config", Message: "config is too large"})
	} else if trimmed := bytes.TrimSpace(req.Config); len(trimmed) == 0 || trimmed[0] != '{' {
		fields = append(fields, FieldError{Field: "config", Message: "config must be a JSON object"})
	}
	if req.Credentials != nil {
		fields = append(fields, validateCredentials(*req.Credentials)...)
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

func validateBaseURL(raw string) string {
	if raw == "" {
		return ""
	}
	if len(raw) > MaxBaseURLLength {
		return "base_url is too long"
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "base_url must be an absolute http:// or https:// address"
	}
	if u.User != nil {
		return "base_url must not contain a user name or password"
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "base_url must not contain a query or fragment"
	}
	return ""
}

func validateCredentials(creds Credentials) []FieldError {
	if len(creds) > MaxCredentialFields {
		return []FieldError{{Field: "credentials", Message: "too many credential fields"}}
	}
	var fields []FieldError
	for name, value := range creds {
		switch {
		case len(name) > credentialNameLength || !credentialNamePattern.MatchString(name):
			fields = append(fields, FieldError{Field: "credentials", Message: "credential names must be lower case identifiers"})
		case len(value) > MaxCredentialValue:
			fields = append(fields, FieldError{Field: "credentials." + name, Message: "credential value is too long"})
		}
	}
	return fields
}

// HealthResponse is the stored health of a plugin.
type HealthResponse struct {
	Status    HealthStatus `json:"status"`
	Detail    string       `json:"detail"`
	CheckedAt *time.Time   `json:"checked_at"`
}

// PluginResponse is a plugin type as every household member sees it. It never
// carries credentials, only has_credentials.
type PluginResponse struct {
	Type           string          `json:"type"`
	Configured     bool            `json:"configured"`
	Enabled        bool            `json:"enabled"`
	BaseURL        string          `json:"base_url"`
	Config         json.RawMessage `json:"config"`
	HasCredentials bool            `json:"has_credentials"`
	Health         HealthResponse  `json:"health"`
	UpdatedAt      *time.Time      `json:"updated_at"`
}

// ListResponse is the body of GET /api/v1/integrations/plugins.
// EncryptionAvailable is false when INTEGRATIONS_ENCRYPTION_KEY is unset, so
// the UI can explain why credentials cannot be saved.
type ListResponse struct {
	Items               []PluginResponse `json:"items"`
	EncryptionAvailable bool             `json:"encryption_available"`
}

// toResponse converts a view; an unconfigured type is disabled and untested.
func toResponse(v View) PluginResponse {
	resp := PluginResponse{
		Type:   v.Type,
		Config: json.RawMessage(`{}`),
		Health: HealthResponse{Status: StatusUnknown},
	}
	if !v.Configured {
		return resp
	}
	rec := v.Record
	resp.Configured = true
	resp.Enabled = rec.Enabled
	resp.BaseURL = rec.BaseURL
	if len(bytes.TrimSpace(rec.Config)) > 0 {
		resp.Config = rec.Config
	}
	resp.HasCredentials = rec.HasCredentials()
	resp.Health = HealthResponse{Status: rec.HealthStatus, Detail: rec.HealthDetail, CheckedAt: rec.HealthCheckedAt}
	updated := rec.UpdatedAt
	resp.UpdatedAt = &updated
	return resp
}
