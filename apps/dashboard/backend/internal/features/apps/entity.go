// Package apps manages app catalog entity models and routing metadata.
package apps

import "time"

// AppCategory defines the application classification type.
type AppCategory string

const (
	CategoryInternal AppCategory = "internal"
	CategoryExternal AppCategory = "external"
)

// AppRole defines the minimum required household role for accessing an application.
type AppRole string

const (
	RoleOwner  AppRole = "OWNER"
	RoleAdmin  AppRole = "ADMIN"
	RoleMember AppRole = "MEMBER"
)

// AppItem represents an application entry registered in the alfheim control plane catalog.
type AppItem struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Title        string      `json:"title,omitempty"`
	Slug         string      `json:"slug"`
	Description  string      `json:"description"`
	IconURL      string      `json:"icon_url"`
	Icon         string      `json:"icon,omitempty"`
	AppURL       string      `json:"app_url"`
	URL          string      `json:"url,omitempty"`
	Category     AppCategory `json:"category"`
	RequiredRole AppRole     `json:"required_role"`
	IsActive     bool        `json:"is_active"`
	IsExternal   bool        `json:"is_external"`
	Status       string      `json:"status"` // "active" | "in_progress" | "maintenance"
	IsDefault    bool        `json:"is_default"`
	DisplayOrder int         `json:"display_order"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}
