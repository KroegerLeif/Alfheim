package modelblocks

import "errors"

var (
	// ErrNotFound indicates the requested model block does not exist.
	ErrNotFound = errors.New("model block not found")
	// ErrForbidden indicates the caller is not permitted to perform the requested
	// action on this model block (e.g. editing a block they do not own).
	ErrForbidden = errors.New("caller is not permitted to modify this model block")
	// ErrBootstrapReadOnly indicates an edit or delete was attempted on an
	// environment-managed bootstrap model block.
	ErrBootstrapReadOnly = errors.New("bootstrap model blocks are managed by the server environment and cannot be changed here")
	// ErrAPIKeyRequiredForBaseURLChange indicates base_url changed on a block with a
	// stored API key without supplying a new key or clearing the old one. Reusing the
	// stored key against a new host would hand the key to that host.
	ErrAPIKeyRequiredForBaseURLChange = errors.New("changing base_url requires a new api_key or clear_api_key, the stored key is not reused for a different endpoint")
	// ErrInvalidBaseURL indicates base_url is not an allowed outbound destination.
	ErrInvalidBaseURL = errors.New("base_url is not an allowed destination: it must be an http(s) URL to a public host or one allow-listed via CHAT_ALLOWED_LLM_HOSTS")
	// ErrDiscoveryUnsupported indicates model auto-discovery is not available for the provider.
	ErrDiscoveryUnsupported = errors.New("auto-discovery is currently only supported for provider 'ollama'")
	// ErrDiscoveryFailed indicates the endpoint could not be queried for its models.
	ErrDiscoveryFailed = errors.New("could not retrieve models from the endpoint")
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
