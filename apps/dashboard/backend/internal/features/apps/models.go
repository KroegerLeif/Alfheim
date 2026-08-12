package apps

import "time"

// TierType defines the application architectural tier classification.
type TierType string

const (
	TierCore  TierType = "core"  // Tier 1: Natively defined core apps
	TierStack TierType = "stack" // Tier 2: Loaded from server YAML config
	TierUser  TierType = "user"  // Tier 3: Stored per-user in PostgreSQL
)

// AppItem represents a unified application item delivered to the frontend dashboard.
type AppItem struct {
	ID            string    `json:"id"`
	Slug          string    `json:"slug"`
	Title         string    `json:"title"`
	Name          string    `json:"name,omitempty"`
	Description   string    `json:"description"`
	Icon          string    `json:"icon"`
	IconURL       string    `json:"icon_url,omitempty"`
	URL           string    `json:"url"`
	AppURL        string    `json:"app_url,omitempty"`
	Category      string    `json:"category"` // "internal" | "external" | "user"
	Tier          TierType  `json:"tier"`     // "core" | "stack" | "user"
	Status        string    `json:"status"`   // "active" | "in_progress" | "maintenance"
	IsHidden      bool      `json:"is_hidden"`
	IsCustom      bool      `json:"is_custom"`
	RequiredRoles []string  `json:"required_roles,omitempty"`
	DisplayOrder  int       `json:"display_order"`
	CreatedAt     time.Time `json:"created_at,omitempty"`
	UpdatedAt     time.Time `json:"updated_at,omitempty"`
}

// DashboardAppsResponse encapsulates the unified dashboard payload for all 3 tiers.
type DashboardAppsResponse struct {
	Core        []AppItem       `json:"core"`
	Stack       []AppItem       `json:"stack"`
	User        []AppItem       `json:"user"`
	AllCore     []AppItem       `json:"all_core,omitempty"`
	Preferences UserPreferences `json:"preferences"`
	Total       int             `json:"total"`
}
