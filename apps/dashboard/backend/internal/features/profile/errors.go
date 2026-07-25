package profile

import "errors"

var (
	// ErrProfileNotFound indicates the requested profile does not exist.
	ErrProfileNotFound = errors.New("user profile not found")
	// ErrFailedToSyncKeycloak indicates failure when interacting with Keycloak User API.
	ErrFailedToSyncKeycloak = errors.New("failed to synchronize profile with keycloak")
)
