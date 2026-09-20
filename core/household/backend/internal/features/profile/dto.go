package profile

import "time"

// ResponseDTO defines the JSON serialization contract for user profiles.
type ResponseDTO struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateDTO defines payload requirements when updating profile details.
type UpdateDTO struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	AvatarURL string `json:"avatar_url"`
}

// ToResponse converts a Profile domain entity to a ResponseDTO.
func ToResponse(p *Profile) ResponseDTO {
	return ResponseDTO{
		ID:        p.ID,
		Email:     p.Email,
		Username:  p.Username,
		FirstName: p.FirstName,
		LastName:  p.LastName,
		AvatarURL: p.AvatarURL,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}
