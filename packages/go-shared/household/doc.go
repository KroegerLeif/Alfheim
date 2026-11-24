// Package household is the Go side of household authorization: a client for the
// membership API of core/household, which owns households, memberships and roles,
// and the RequireHousehold and RequireHouseholdRole middleware that use it.
//
// Zitadel only authenticates users; it never issues household claims. The
// household a request acts in comes from the X-Household-ID header and is
// confirmed per request against core/household, and the role comes from that
// membership answer, never from the JWT. The package reads no environment
// variables: callers pass the base URL and service token to New.
package household
