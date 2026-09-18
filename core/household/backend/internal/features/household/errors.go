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
	// ErrInvalidRole indicates a role string outside OWNER, ADMIN, MEMBER, GUEST.
	ErrInvalidRole = errors.New("invalid household role")
	// ErrOwnerRoleNotAssignable indicates an attempt to grant OWNER via an invite
	// or a role update. Ownership only changes through transfer-ownership.
	ErrOwnerRoleNotAssignable = errors.New("the OWNER role can only be assigned via transfer-ownership")
	// ErrCannotChangeOwnerRole indicates an attempt to change the owner's role directly.
	ErrCannotChangeOwnerRole = errors.New("the owner's role can only be changed via transfer-ownership")
	// ErrOwnerCannotLeave indicates the owner tried to leave their own household.
	ErrOwnerCannotLeave = errors.New("the owner must transfer ownership or delete the household before leaving")
	// ErrInvalidHouseholdName indicates an empty, unsluggable or too long household name.
	ErrInvalidHouseholdName = errors.New("invalid household name")
	// ErrInvalidTransferTarget indicates a missing transfer target or a transfer to oneself.
	ErrInvalidTransferTarget = errors.New("invalid ownership transfer target")
)
