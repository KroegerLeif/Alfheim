package servicebindings

import "errors"

var (
	// ErrForbidden means the caller is not an OWNER or ADMIN of the household.
	ErrForbidden = errors.New("only household owners and admins can manage service bindings")
	// ErrNotFound means the principal has no binding to the household.
	ErrNotFound = errors.New("service binding not found")
	// ErrUnknownPrincipal means the subject is not a configured service principal
	// (ALFHEIM_SERVICE_PRINCIPAL_IDS).
	ErrUnknownPrincipal = errors.New("principal_id is not a configured service principal")
	// ErrInvalidScopes means the scope list is empty, too long, has duplicates or
	// an entry that is not of the form "<app>:<action>".
	ErrInvalidScopes = errors.New("scopes must be 1-16 distinct values of the form <app>:<action>")
	// ErrPrincipalIsMember means the principal is a member of the household; a
	// subject is either a member or a service principal, never both.
	ErrPrincipalIsMember = errors.New("a household member cannot be bound as a service principal")
)
