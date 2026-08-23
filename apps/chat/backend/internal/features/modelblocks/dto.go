package modelblocks

import (
	"encoding/json"
	"time"
)

// CreateRequest is the payload for POST /api/v1/chat/model-blocks.
type CreateRequest struct {
	DisplayName     string  `json:"display_name"`
	ProviderType    string  `json:"provider_type"`
	BaseURL         *string `json:"base_url,omitempty"`
	ModelIdentifier string  `json:"model_identifier"`
	// APIKey is the plaintext provider API key, encrypted before persistence and
	// never echoed back. Omit for providers that need no key (e.g. local Ollama).
	APIKey     *string         `json:"api_key,omitempty"`
	Visibility Visibility      `json:"visibility"`
	ConfigJSON json.RawMessage `json:"config,omitempty"`
}

// UpdateRequest is the payload for PATCH /api/v1/chat/model-blocks/{id}.
// All fields are optional; only non-nil fields are applied.
type UpdateRequest struct {
	DisplayName     *string `json:"display_name,omitempty"`
	BaseURL         *string `json:"base_url,omitempty"`
	ModelIdentifier *string `json:"model_identifier,omitempty"`
	APIKey          *string `json:"api_key,omitempty"`
	// ClearAPIKey removes a previously stored API key. Ignored if APIKey is also set.
	ClearAPIKey bool            `json:"clear_api_key,omitempty"`
	Visibility  *Visibility     `json:"visibility,omitempty"`
	ConfigJSON  json.RawMessage `json:"config,omitempty"`
}

// ResponseDTO is the JSON serialization contract for a model block. It never exposes
// the encrypted API key ciphertext, only whether one is configured.
type ResponseDTO struct {
	ID              string          `json:"id"`
	OwnerUserID     string          `json:"owner_user_id"`
	HouseholdID     *string         `json:"household_id,omitempty"`
	Visibility      Visibility      `json:"visibility"`
	ProviderType    string          `json:"provider_type"`
	DisplayName     string          `json:"display_name"`
	BaseURL         *string         `json:"base_url,omitempty"`
	ModelIdentifier string          `json:"model_identifier"`
	HasAPIKey       bool            `json:"has_api_key"`
	ConfigJSON      json.RawMessage `json:"config"`
	HealthStatus    HealthStatus    `json:"health_status"`
	HealthCheckedAt *time.Time      `json:"health_checked_at,omitempty"`
	HealthDetail    *string         `json:"health_detail,omitempty"`
	IsBootstrap     bool            `json:"is_bootstrap"`
	IsOwner         bool            `json:"is_owner"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// ToResponse converts a ModelBlock domain entity to its response DTO, scoped to the
// requesting user so IsOwner reflects their edit/delete permission.
func ToResponse(m *ModelBlock, requestingUserID string) ResponseDTO {
	cfg := m.ConfigJSON
	if len(cfg) == 0 {
		cfg = json.RawMessage("{}")
	}
	return ResponseDTO{
		ID:              m.ID,
		OwnerUserID:     m.OwnerUserID,
		HouseholdID:     m.HouseholdID,
		Visibility:      m.Visibility,
		ProviderType:    m.ProviderType,
		DisplayName:     m.DisplayName,
		BaseURL:         m.BaseURL,
		ModelIdentifier: m.ModelIdentifier,
		HasAPIKey:       m.HasAPIKey(),
		ConfigJSON:      cfg,
		HealthStatus:    m.HealthStatus,
		HealthCheckedAt: m.HealthCheckedAt,
		HealthDetail:    m.HealthDetail,
		IsBootstrap:     m.IsBootstrap,
		IsOwner:         m.IsOwnedBy(requestingUserID),
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}
