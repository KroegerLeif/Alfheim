package household

import "errors"

var (
	// ErrHouseholdNotFound indicates the requested household does not exist.
	ErrHouseholdNotFound = errors.New("household not found")
	// ErrHouseholdSlugExists indicates a duplicate household slug.
	ErrHouseholdSlugExists = errors.New("household slug already in use")
	// ErrMemberAlreadyExists indicates the user is already a member.
	ErrMemberAlreadyExists = errors.New("user is already a member of this household")
	// ErrUnauthorizedHouseholdAccess indicates insufficient permissions for the household.
	ErrUnauthorizedHouseholdAccess = errors.New("unauthorized household action")
)
