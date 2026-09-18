package contact

import "time"

// ContactCategory defines a grouping category for household contacts.
type ContactCategory struct {
	ID          string    `json:"id"`
	HouseholdID string    `json:"household_id"`
	Name        string    `json:"name"`
	Icon        string    `json:"icon"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Contact defines a geocoded person or business location in a household directory.
type Contact struct {
	ID          string    `json:"id"`
	HouseholdID string    `json:"household_id"`
	CategoryID  *string   `json:"category_id"`
	Name        string    `json:"name"`
	Phone       string    `json:"phone"`
	Email       string    `json:"email"`
	Address     string    `json:"address"`
	Latitude    *float64  `json:"latitude"`
	Longitude   *float64  `json:"longitude"`
	Description string    `json:"description"`
	Links       []string  `json:"links"`
	Icon        string    `json:"icon"`
	AvatarURL   string    `json:"avatar_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
