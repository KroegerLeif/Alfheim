// Package household manages household domains, membership roles, and invitations.
package household

import "time"

// HouseholdRole defines permission levels within a household.
type HouseholdRole string

const (
	RoleOwner  HouseholdRole = "OWNER"
	RoleAdmin  HouseholdRole = "ADMIN"
	RoleMember HouseholdRole = "MEMBER"
	RoleGuest  HouseholdRole = "GUEST"
)

// ParseRole validates a role string. Only the exact upper-case names OWNER,
// ADMIN, MEMBER and GUEST are accepted; anything else yields ErrInvalidRole.
func ParseRole(s string) (HouseholdRole, error) {
	switch r := HouseholdRole(s); r {
	case RoleOwner, RoleAdmin, RoleMember, RoleGuest:
		return r, nil
	default:
		return "", ErrInvalidRole
	}
}

// CanManage reports whether the role may administer a household
// (invites, member roles, address, name).
func (r HouseholdRole) CanManage() bool {
	return r == RoleOwner || r == RoleAdmin
}

// maxHouseholdNameLength mirrors households.name VARCHAR(150).
const maxHouseholdNameLength = 150

// Household represents a household business domain entity.
type Household struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	OwnerID   string    `json:"owner_id"`
	Street    string    `json:"street"`
	Zip       string    `json:"zip"`
	City      string    `json:"city"`
	Country   string    `json:"country"`
	Latitude  *float64  `json:"latitude"`
	Longitude *float64  `json:"longitude"`
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
