package plugins

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Record is one row of household_plugins: a household's configuration of one
// plugin type. CredentialsEncrypted is AES-256-GCM ciphertext; it never leaves
// the backend.
type Record struct {
	ID                   uuid.UUID
	HouseholdID          uuid.UUID
	Type                 string
	Enabled              bool
	BaseURL              string
	Config               json.RawMessage
	CredentialsEncrypted []byte
	CredentialsKeyID     string
	HealthStatus         HealthStatus
	HealthCheckedAt      *time.Time
	HealthDetail         string
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

// HasCredentials reports whether the row stores encrypted credentials.
func (r Record) HasCredentials() bool {
	return len(r.CredentialsEncrypted) > 0
}

// pluginConfig returns the plugin-facing configuration of the row.
func (r Record) pluginConfig() Config {
	return Config{BaseURL: r.BaseURL, Settings: r.Config}
}

// HealthResult is a stored health check outcome.
type HealthResult struct {
	Status    HealthStatus
	Detail    string
	CheckedAt time.Time
}

// View is a plugin type as the API lists it: a registered type merged with the
// household's row, if any. It carries no secret.
type View struct {
	Type       string
	Configured bool
	Record     Record
}

// Instance is a household's configured plugin with decrypted credentials,
// ready for an outbound call. It exists only in memory, for the length of one
// request; never log it or put it in a response.
type Instance struct {
	// ID is the household_plugins row id; the Home Assistant webhook uses it
	// as its public webhook id.
	ID          uuid.UUID
	HouseholdID uuid.UUID
	Type        string
	Enabled     bool
	Config      Config
	Credentials Credentials
}
