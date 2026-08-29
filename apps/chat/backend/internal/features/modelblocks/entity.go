// Package modelblocks manages user- and household-scoped LLM provider configurations
// ("model blocks"): CRUD, ownership/sharing rules, and on-demand health checks.
package modelblocks

import "time"

// Visibility controls who besides the owner may use a model block.
type Visibility string

const (
	// VisibilityPrivate restricts a model block to its owner.
	VisibilityPrivate Visibility = "private"
	// VisibilityShared allows any member of the owner's household to select and use
	// the model block in chat, but never to edit or delete it.
	VisibilityShared Visibility = "shared"
)

// HealthStatus mirrors llm.HealthStatus for persistence; kept as its own type so this
// package does not need to import internal/shared/llm just for the enum values.
type HealthStatus string

const (
	HealthStatusOK          HealthStatus = "ok"
	HealthStatusUnreachable HealthStatus = "unreachable"
	HealthStatusAuthInvalid HealthStatus = "auth_invalid"
	HealthStatusUnknown     HealthStatus = "unknown"
)

// ModelBlock is a single configured LLM provider connection.
type ModelBlock struct {
	ID              string
	OwnerUserID     string
	HouseholdID     *string
	Visibility      Visibility
	ProviderType    string
	DisplayName     string
	BaseURL         *string
	ModelIdentifier string
	// APIKeyEncrypted holds the AES-256-GCM ciphertext; nil when the provider needs no key.
	APIKeyEncrypted []byte
	APIKeyKeyID     string
	// ConfigJSON holds provider/runtime tuning (temperature, allowed_mcp_apps, tool_round_limit, ...).
	ConfigJSON      []byte
	HealthStatus    HealthStatus
	HealthCheckedAt *time.Time
	HealthDetail    *string
	IsBootstrap     bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// HasAPIKey reports whether an encrypted API key is stored for this model block.
// Used to populate the has_api_key response field without ever exposing ciphertext.
func (m *ModelBlock) HasAPIKey() bool {
	return len(m.APIKeyEncrypted) > 0
}

// IsOwnedBy reports whether userID owns this model block.
func (m *ModelBlock) IsOwnedBy(userID string) bool {
	return m.OwnerUserID == userID
}

// IsVisibleTo reports whether a user in the given household may see and select this
// model block. Ownership always grants visibility; otherwise the block must be
// shared and scoped to the caller's household, or a bootstrap block (visible to
// everyone, see CanModify).
func (m *ModelBlock) IsVisibleTo(userID, householdID string) bool {
	if m.IsOwnedBy(userID) || m.IsBootstrap {
		return true
	}
	if m.Visibility != VisibilityShared || householdID == "" {
		return false
	}
	return m.HouseholdID != nil && *m.HouseholdID == householdID
}

// CanModify reports whether userID may edit, delete, or trigger a health check for
// this model block. Regular blocks may only be modified by their owner (shared
// blocks are usable by the household but not editable, per product decision).
// Bootstrap blocks are a deliberate exception: they are seeded from server ENV vars
// with no natural personal owner ("system"), so any authenticated user may take them
// over once created — after which they behave like any other block they now own in
// spirit, even though ownership in the database stays "system".
func (m *ModelBlock) CanModify(userID string) bool {
	return m.IsOwnedBy(userID) || m.IsBootstrap
}
