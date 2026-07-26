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

// Member represents a user's membership in a household with optional profile details.
type Member struct {
	HouseholdID string        `json:"household_id"`
	UserID      string        `json:"user_id"`
	Email       string        `json:"email,omitempty"`
	Username    string        `json:"username,omitempty"`
	FirstName   string        `json:"first_name,omitempty"`
	LastName    string        `json:"last_name,omitempty"`
	AvatarURL   string        `json:"avatar_url,omitempty"`
	Role        HouseholdRole `json:"role"`
	JoinedAt    time.Time     `json:"joined_at"`
}

// Invite represents an invitation token generated for joining a household.
type Invite struct {
	Token       string        `json:"token"`
	HouseholdID string        `json:"household_id"`
	InviterID   string        `json:"inviter_id"`
	Role        HouseholdRole `json:"role"`
	ExpiresAt   time.Time     `json:"expires_at"`
	MaxUses     int           `json:"max_uses"`
	Uses        int           `json:"uses"`
	CreatedAt   time.Time     `json:"created_at"`
}

// IsValid checks whether an invitation is expired or has reached its usage limit.
func (i *Invite) IsValid() bool {
	if time.Now().After(i.ExpiresAt) {
		return false
	}
	if i.MaxUses > 0 && i.Uses >= i.MaxUses {
		return false
	}
	return true
}
