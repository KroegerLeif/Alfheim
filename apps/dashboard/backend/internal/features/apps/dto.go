package apps

// AppResponseDTO formats application metadata for client consumption.
type AppResponseDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	IconURL     string `json:"icon_url"`
	AppURL      string `json:"app_url"`
}

// ToResponse converts App domain entity to DTO.
func ToResponse(a *App) AppResponseDTO {
	return AppResponseDTO{
		ID:          a.ID,
		Name:        a.Name,
		Slug:        a.Slug,
		Description: a.Description,
		IconURL:     a.IconURL,
		AppURL:      a.AppURL,
	}
}
