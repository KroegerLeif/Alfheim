package household

import "time"

// CreateHouseholdRequest DTO payload for creating a household.
type CreateHouseholdRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// HouseholdResponse DTO representation for household responses.
type HouseholdResponse struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Slug      string           `json:"slug"`
	OwnerID   string           `json:"owner_id"`
	Role      string           `json:"role,omitempty"`
	Members   []MemberResponse `json:"members,omitempty"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
}

// MemberResponse DTO for member representation.
type MemberResponse struct {
	HouseholdID string    `json:"household_id"`
	UserID      string    `json:"user_id"`
	Role        string    `json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
}

// CreateInviteRequest DTO for generating a QR invite token.
type CreateInviteRequest struct {
	HouseholdID string `json:"household_id"`
	Role        string `json:"role"`
	TTLMinutes  int    `json:"ttl_minutes"`
	MaxUses     int    `json:"max_uses"`
}

// InviteResponse DTO returned upon invite creation.
type InviteResponse struct {
	Token       string    `json:"token"`
	HouseholdID string    `json:"household_id"`
	Role        string    `json:"role"`
	ExpiresAt   time.Time `json:"expires_at"`
	MaxUses     int       `json:"max_uses"`
	Uses        int       `json:"uses"`
}

// JoinHouseholdRequest DTO for joining via QR invite token.
type JoinHouseholdRequest struct {
	Token string `json:"token"`
}

// UpdateMemberRoleRequest DTO for modifying member privileges.
type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

// ToHouseholdResponse converts domain Household entity to response DTO.
func ToHouseholdResponse(h *Household, role string, members []MemberResponse) HouseholdResponse {
	return HouseholdResponse{
		ID:        h.ID,
		Name:      h.Name,
		Slug:      h.Slug,
		OwnerID:   h.OwnerID,
		Role:      role,
		Members:   members,
		CreatedAt: h.CreatedAt,
		UpdatedAt: h.UpdatedAt,
	}
}

// ToMemberResponse converts domain Member entity to response DTO.
func ToMemberResponse(m *Member) MemberResponse {
	return MemberResponse{
		HouseholdID: m.HouseholdID,
		UserID:      m.UserID,
		Role:        string(m.Role),
		JoinedAt:    m.JoinedAt,
	}
}

// ToInviteResponse converts domain Invite entity to response DTO.
func ToInviteResponse(i *Invite) InviteResponse {
	return InviteResponse{
		Token:       i.Token,
		HouseholdID: i.HouseholdID,
		Role:        string(i.Role),
		ExpiresAt:   i.ExpiresAt,
		MaxUses:     i.MaxUses,
		Uses:        i.Uses,
	}
}
