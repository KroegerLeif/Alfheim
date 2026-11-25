package plugins

import (
	"errors"
	"strings"
)

// Sentinel errors of the plugin service. Callers match them with errors.Is.
var (
	// ErrUnknownType means the build has no plugin of the requested type.
	ErrUnknownType = errors.New("plugin type is not registered")
	// ErrNotConfigured means the household has no stored row for the type.
	// Another household's row is reported the same way, so rows of other
	// households cannot be probed.
	ErrNotConfigured = errors.New("plugin is not configured for this household")
	// ErrDisabled means the household configured the plugin but switched it off.
	ErrDisabled = errors.New("plugin is disabled for this household")
	// ErrHostNotAllowed means the plugin's base URL is outside the netguard
	// allowlist (INTEGRATIONS_ALLOWED_HOSTS); no request was sent.
	ErrHostNotAllowed = errors.New("plugin base url is not an allowed destination")
	// ErrEncryptionUnavailable means INTEGRATIONS_ENCRYPTION_KEY is not set, so
	// credentials can neither be stored nor read. The rest of the dashboard
	// keeps working (fail closed for secrets only).
	ErrEncryptionUnavailable = errors.New("integrations encryption key is not configured")
	// ErrKeyMismatch means a row was encrypted with a key id other than the
	// configured one; the credentials stay unreadable until re-entered.
	ErrKeyMismatch = errors.New("plugin credentials were encrypted with another key")
)

// FieldError describes one rejected request field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationError lists every rejected field of a request. Input is rejected,
// never sanitized. Plugins may return it from ValidateConfig.
type ValidationError struct {
	Fields []FieldError
}

// Error joins the field messages.
func (e *ValidationError) Error() string {
	parts := make([]string, 0, len(e.Fields))
	for _, f := range e.Fields {
		parts = append(parts, f.Field+": "+f.Message)
	}
	return "invalid plugin configuration: " + strings.Join(parts, "; ")
}

// NewValidationError returns a ValidationError for one field.
func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{Fields: []FieldError{{Field: field, Message: message}}}
}
