// Package onboarding collects the domain and image settings that identify an
// Alfheim installation.
package onboarding

// PresetID selects a bundle of pre-filled domain defaults.
type PresetID string

const (
	// PresetLoegien is the maintainer's production deployment on loegien.de.
	PresetLoegien PresetID = "loegien"
	// PresetCustom prompts for every domain value.
	PresetCustom PresetID = "custom"
	// PresetLocalhost targets a LAN or offline installation.
	PresetLocalhost PresetID = "localhost"
)

// Config holds the answers of the domain step.
type Config struct {
	Preset     PresetID
	BaseDomain string // loegien.de
	AppHost    string // alfheim.loegien.de
	AuthHost   string // auth.loegien.de, derived from BaseDomain
	AdminEmail string
	Registry   string
	Repo       string
	ImageTag   string

	// Derived values, filled by Derive.
	BaseURL   string // https://alfheim.loegien.de
	IssuerURL string // https://auth.loegien.de
	Secure    bool   // false only for a plain-HTTP localhost install
}

// Defaults for the container image coordinates, matching .env.example.
const (
	DefaultRegistry = "ghcr.io"
	DefaultRepo     = "kroegerleif/alfheim"
	DefaultImageTag = "latest"
)
