package apps

import "errors"

var (
	ErrLinkNotFound      = errors.New("user link not found")
	ErrUnauthorizedLink  = errors.New("unauthorized to access or modify this link")
	ErrInvalidLinkInputs = errors.New("link title and url are required")
)
