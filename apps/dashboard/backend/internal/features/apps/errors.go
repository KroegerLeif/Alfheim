package apps

import "errors"

var (
	// ErrAppNotFound indicates the requested application was not found in the catalog.
	ErrAppNotFound = errors.New("app not found in catalog")
)
