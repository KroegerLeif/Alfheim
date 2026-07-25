package household

import "time"

// CreateHouseholdDTO holds input for creating a household.
type CreateHouseholdDTO struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// HouseholdResponseDTO formatted response for household endpoints.
type HouseholdResponseDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	OwnerID   string    `json:"owner_id"`
	Role      string    `json:"role,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AddMemberDTO input for adding a member to a household.
type AddMemberDTO struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

// ToResponse converts Household domain entity into DTO payload.
func ToResponse(h *Household, role string) HouseholdResponseDTO {
	return HouseholdResponseDTO{
		ID:        h.ID,
		Name:      h.Name,
		Slug:      h.Slug,
		OwnerID:   h.OwnerID,
		Role:      role,
		CreatedAt: h.CreatedAt,
		UpdatedAt: h.UpdatedAt,
	}
}
