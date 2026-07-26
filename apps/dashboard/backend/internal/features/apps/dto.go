package apps

// AppDTO defines the JSON structure for single app catalog items.
type AppDTO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	Description  string `json:"description"`
	IconURL      string `json:"icon_url"`
	Icon         string `json:"icon"`
	AppURL       string `json:"app_url"`
	URL          string `json:"url"`
	Category     string `json:"category"`
	RequiredRole string `json:"required_role"`
	IsExternal   bool   `json:"is_external"`
	Status       string `json:"status"`
	IsDefault    bool   `json:"is_default"`
	DisplayOrder int    `json:"display_order"`
}

// CreateAppRequest payload for POST /api/v1/apps.
type CreateAppRequest struct {
	Title        string `json:"title"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Icon         string `json:"icon"`
	IconURL      string `json:"icon_url"`
	URL          string `json:"url"`
	AppURL       string `json:"app_url"`
	IsExternal   bool   `json:"is_external"`
	Category     string `json:"category"`
	Status       string `json:"status"`
	RequiredRole string `json:"required_role"`
}

// UpdateAppRequest payload for PUT /api/v1/apps/{id}.
type UpdateAppRequest struct {
	Title       string `json:"title"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description"`
	URL         string `json:"url"`
	AppURL      string `json:"app_url,omitempty"`
	Icon        string `json:"icon"`
	IconURL     string `json:"icon_url,omitempty"`
	IsExternal  bool   `json:"is_external"`
	Status      string `json:"status"`
}

// AppCatalogResponse groups accessible applications by category.
type AppCatalogResponse struct {
	Internal []AppDTO `json:"internal"`
	External []AppDTO `json:"external"`
	Total    int      `json:"total"`
}

// ToDTO converts an AppItem domain entity to AppDTO.
func ToDTO(a *AppItem) AppDTO {
	name := a.Name
	if name == "" {
		name = a.Title
	}
	title := a.Title
	if title == "" {
		title = name
	}
	appURL := a.AppURL
	if appURL == "" {
		appURL = a.URL
	}
	url := a.URL
	if url == "" {
		url = appURL
	}
	iconURL := a.IconURL
	if iconURL == "" {
		iconURL = a.Icon
	}
	icon := a.Icon
	if icon == "" {
		icon = iconURL
	}
	status := a.Status
	if status == "" {
		status = "active"
	}
	return AppDTO{
		ID:           a.ID,
		Name:         name,
		Title:        title,
		Slug:         a.Slug,
		Description:  a.Description,
		IconURL:      iconURL,
		Icon:         icon,
		AppURL:       appURL,
		URL:          url,
		Category:     string(a.Category),
		RequiredRole: string(a.RequiredRole),
		IsExternal:   a.IsExternal,
		Status:       status,
		IsDefault:    a.IsDefault,
		DisplayOrder: a.DisplayOrder,
	}
}
