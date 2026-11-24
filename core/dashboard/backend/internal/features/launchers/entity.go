// Package launchers is the household scope of dashboard tiles: links to other
// web apps (Home Assistant, Jellyfin, any URL) that a household's owners and
// admins manage and every member sees. A launcher is UI only (ADR 0010): the
// backend never calls the target, stores no credential for it, and the
// frontend opens it in a new tab.
package launchers

import (
	"time"

	"github.com/google/uuid"
)

// Launcher is one household-managed link tile.
type Launcher struct {
	ID           uuid.UUID
	HouseholdID  uuid.UUID
	Title        string
	URL          string
	Icon         string
	Description  string
	DisplayOrder int
	// CreatedBy is the OIDC subject of the admin who added the launcher.
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Page is one page of a household's launchers plus the total count.
type Page struct {
	Items []Launcher
	Total int
}
