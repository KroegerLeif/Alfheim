package apps

import "time"

// UserLink represents a Tier 3 custom bookmark created by a user.
type UserLink struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	URL          string    `json:"url"`
	Icon         string    `json:"icon"`
	Category     string    `json:"category"`
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
