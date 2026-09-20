package profile

import "errors"

// ErrProfileNotFound indicates the requested profile does not exist.
var ErrProfileNotFound = errors.New("user profile not found")
