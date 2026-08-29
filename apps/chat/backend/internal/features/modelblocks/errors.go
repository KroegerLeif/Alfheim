package modelblocks

import "errors"

var (
	// ErrNotFound indicates the requested model block does not exist.
	ErrNotFound = errors.New("model block not found")
	// ErrForbidden indicates the caller is not permitted to perform the requested
	// action on this model block (e.g. editing a block they do not own).
	ErrForbidden = errors.New("caller is not permitted to modify this model block")
	// ErrMissingHouseholdID indicates a shared model block was requested without a
	// household context available on the caller's token.
	ErrMissingHouseholdID = errors.New("household_id is required to create a shared model block")
	// ErrInvalidVisibility indicates an unsupported visibility value was supplied.
	ErrInvalidVisibility = errors.New("visibility must be \"private\" or \"shared\"")
	// ErrInvalidProviderType indicates provider_type is empty or unsupported.
	ErrInvalidProviderType = errors.New("provider_type is required")
	// ErrEncryptionKeyMissing indicates an API key was supplied but CHAT_ENCRYPTION_KEY
	// is not configured, so it cannot be safely encrypted at rest.
	ErrEncryptionKeyMissing = errors.New("cannot store an api key: CHAT_ENCRYPTION_KEY is not configured")
)
