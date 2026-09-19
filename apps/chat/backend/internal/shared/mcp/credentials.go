package mcp

import "context"

const (
	headerAuthorization = "Authorization"
	headerHouseholdID   = "X-Household-ID"
)

// CallerCredentials identify the end user a chat turn acts for. They are forwarded
// on every MCP request so the Fach-App's MCP middleware can authorize the call as
// that user within that household (chat never calls MCP servers as itself).
type CallerCredentials struct {
	// AccessToken is the user's OIDC access token, sent as "Authorization: Bearer".
	AccessToken string
	// HouseholdID is the verified household UUID, sent as X-Household-ID.
	HouseholdID string
}

// String redacts the token so credentials can never leak through %v logging.
func (c CallerCredentials) String() string {
	return "CallerCredentials{HouseholdID:" + c.HouseholdID + ", AccessToken:[redacted]}"
}

type credentialsKey struct{}

// WithCallerCredentials returns a context carrying creds. Every MCP request made
// with the returned context (or a context derived from it) forwards them.
func WithCallerCredentials(ctx context.Context, creds CallerCredentials) context.Context {
	return context.WithValue(ctx, credentialsKey{}, creds)
}

// CallerCredentialsFrom returns the credentials stored in ctx, if any.
func CallerCredentialsFrom(ctx context.Context) (CallerCredentials, bool) {
	creds, ok := ctx.Value(credentialsKey{}).(CallerCredentials)
	return creds, ok
}
