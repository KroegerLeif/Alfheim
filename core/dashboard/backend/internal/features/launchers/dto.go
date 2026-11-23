package launchers

import (
	"net/url"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Field limits, mirrored by the column sizes of migration 000008.
const (
	MaxTitleLength       = 100
	MaxURLLength         = 2048
	MaxDescriptionLength = 500
	MaxDisplayOrder      = 10000
)

// LauncherRequest is the body of POST and PUT /api/v1/launchers. It carries no
// household id: the household always comes from the membership check.
type LauncherRequest struct {
	Title        string `json:"title"`
	URL          string `json:"url"`
	Icon         string `json:"icon"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"display_order"`
}

// Validate checks every field and returns a *ValidationError listing all
// rejected fields, or nil. Nothing is trimmed or rewritten.
func (r LauncherRequest) Validate() error {
	var fields []FieldError
	add := func(field, msg string) { fields = append(fields, FieldError{Field: field, Message: msg}) }

	switch {
	case strings.TrimSpace(r.Title) == "":
		add("title", "title is required")
	case utf8.RuneCountInString(r.Title) > MaxTitleLength:
		add("title", "title is too long")
	case hasControl(r.Title):
		add("title", "title must not contain control characters")
	}
	if msg := validateURL(r.URL); msg != "" {
		add("url", msg)
	}
	if r.Icon != "" && !IconAllowed(r.Icon) {
		add("icon", "icon is not in the allowed icon set")
	}
	if utf8.RuneCountInString(r.Description) > MaxDescriptionLength {
		add("description", "description is too long")
	}
	if r.DisplayOrder < 0 || r.DisplayOrder > MaxDisplayOrder {
		add("display_order", "display_order is out of range")
	}

	if len(fields) == 0 {
		return nil
	}
	return &ValidationError{Fields: fields}
}

// validateURL returns why raw is not an acceptable launcher target, or "".
// Only absolute http(s) URLs with a host and without userinfo pass, which keeps
// javascript:, data: and credential-carrying links off the dashboard.
func validateURL(raw string) string {
	if raw == "" {
		return "url is required"
	}
	if len(raw) > MaxURLLength {
		return "url is too long"
	}
	if raw != strings.TrimSpace(raw) || hasControl(raw) || strings.ContainsAny(raw, " \\") {
		return "url must not contain whitespace, control characters or backslashes"
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "url is not a valid URL"
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "url scheme must be http or https"
	}
	if u.User != nil {
		return "url must not contain a user name or password"
	}
	if u.Host == "" || u.Hostname() == "" {
		return "url must name a host"
	}
	return ""
}

func hasControl(s string) bool {
	return strings.IndexFunc(s, unicode.IsControl) >= 0
}

// LauncherResponse is one launcher as the API returns it.
type LauncherResponse struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	URL          string    `json:"url"`
	Icon         string    `json:"icon"`
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ListResponse is the page object of GET /api/v1/launchers (ADR 0011).
type ListResponse struct {
	Items  []LauncherResponse `json:"items"`
	Total  int                `json:"total"`
	Limit  int                `json:"limit"`
	Offset int                `json:"offset"`
}

func toResponse(l Launcher) LauncherResponse {
	return LauncherResponse{
		ID:           l.ID.String(),
		Title:        l.Title,
		URL:          l.URL,
		Icon:         l.Icon,
		Description:  l.Description,
		DisplayOrder: l.DisplayOrder,
		CreatedAt:    l.CreatedAt,
		UpdatedAt:    l.UpdatedAt,
	}
}
