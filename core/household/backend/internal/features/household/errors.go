package household

import "errors"

var (
	// ErrHouseholdNotFound indicates the requested household does not exist.
	ErrHouseholdNotFound = errors.New("household not found")
	// ErrHouseholdSlugExists indicates a duplicate household slug.
	ErrHouseholdSlugExists = errors.New("household slug already in use")
	// ErrMemberAlreadyExists indicates the user is already a member.
	ErrMemberAlreadyExists = errors.New("user is already a member of this household")
	// ErrMemberNotFound indicates the user is not a member of the household.
	ErrMemberNotFound = errors.New("household member not found")
	// ErrUnauthorizedHouseholdAccess indicates insufficient permissions for the household.
	ErrUnauthorizedHouseholdAccess = errors.New("unauthorized household action")
	// ErrInviteNotFound indicates the invite token does not exist.
	ErrInviteNotFound = errors.New("invite token not found")
	// ErrInviteExpiredOrInvalid indicates the invite token is expired or exceeded usage limit.
	ErrInviteExpiredOrInvalid = errors.New("invite token is expired or invalid")
	// ErrCannotRemoveOwner indicates that the household owner cannot be removed.
	ErrCannotRemoveOwner = errors.New("household owner cannot be removed")
)
