package launchers

import (
	"errors"
	"strings"
)

// ErrNotFound means no launcher with that id exists in the caller's household.
// A launcher of another household is reported the same way, so ids of other
// households cannot be probed.
var ErrNotFound = errors.New("launcher not found")

// FieldError describes one rejected request field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationError lists every rejected field of a request. Input is rejected,
// never sanitized.
type ValidationError struct {
	Fields []FieldError
}

func (e *ValidationError) Error() string {
	parts := make([]string, 0, len(e.Fields))
	for _, f := range e.Fields {
		parts = append(parts, f.Field+": "+f.Message)
	}
	return "invalid launcher: " + strings.Join(parts, "; ")
}
