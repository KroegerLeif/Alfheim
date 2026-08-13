package apps

// CreateUserLinkRequest payload for creating a new Tier 3 custom user link.
type CreateUserLinkRequest struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
}

// UpdateUserLinkRequest payload for updating an existing Tier 3 custom user link.
type UpdateUserLinkRequest struct {
	Title       string `json:"title,omitempty"`
	URL         string `json:"url,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
}

// UpdateUserPreferencesRequest payload for modifying user preferences (e.g. hidden Core Apps).
type UpdateUserPreferencesRequest struct {
	HiddenAppIDs []string `json:"hidden_app_ids"`
}
