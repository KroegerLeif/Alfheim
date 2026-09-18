package contact

import "errors"

var (
	// ErrContactNotFound occurs if request details reference non-existent contact.
	ErrContactNotFound = errors.New("contact not found")
	// ErrCategoryNotFound occurs if request details reference non-existent category.
	ErrCategoryNotFound = errors.New("contact category not found")
)
