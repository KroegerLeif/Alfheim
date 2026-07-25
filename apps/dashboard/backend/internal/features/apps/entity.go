// Package apps manages app catalog entity models and routing metadata.
package apps

import "time"

// App represents an application entry registered in the loeger-os control plane.
type App struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	IconURL      string    `json:"icon_url"`
	AppURL       string    `json:"app_url"`
	RequiredRole string    `json:"required_role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
