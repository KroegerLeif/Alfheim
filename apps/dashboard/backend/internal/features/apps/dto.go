package apps

// AppDTO defines the JSON structure for single app catalog items.
type AppDTO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Description  string `json:"description"`
	IconURL      string `json:"icon_url"`
	AppURL       string `json:"app_url"`
	Category     string `json:"category"`
	RequiredRole string `json:"required_role"`
	DisplayOrder int    `json:"display_order"`
}

// AppCatalogResponse groups accessible applications by category.
type AppCatalogResponse struct {
	Internal []AppDTO `json:"internal"`
	External []AppDTO `json:"external"`
	Total    int      `json:"total"`
}

// ToDTO converts an AppItem domain entity to AppDTO.
func ToDTO(a *AppItem) AppDTO {
	return AppDTO{
		ID:           a.ID,
		Name:         a.Name,
		Slug:         a.Slug,
		Description:  a.Description,
		IconURL:      a.IconURL,
		AppURL:       a.AppURL,
		Category:     string(a.Category),
		RequiredRole: string(a.RequiredRole),
		DisplayOrder: a.DisplayOrder,
	}
}
