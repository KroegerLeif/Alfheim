// Package household manages household domains, membership roles, and invitations.
package household

import "time"

// HouseholdRole defines permission levels within a household.
type HouseholdRole string

const (
	RoleOwner  HouseholdRole = "OWNER"
	RoleAdmin  HouseholdRole = "ADMIN"
	RoleMember HouseholdRole = "MEMBER"
)

// Household represents a household business domain entity.
type Household struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	OwnerID   string    `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Member represents a user's membership in a household.
type Member struct {
	HouseholdID string        `json:"household_id"`
	UserID      string        `json:"user_id"`
	Role        HouseholdRole `json:"role"`
	JoinedAt    time.Time     `json:"joined_at"`
}
