package apps

import "time"

// UserPreferences represents a user's dashboard preferences (e.g. hidden Core Apps).
type UserPreferences struct {
	UserID       string    `json:"user_id"`
	HiddenAppIDs []string  `json:"hidden_app_ids"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
}
