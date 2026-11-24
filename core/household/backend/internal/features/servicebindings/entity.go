// Package servicebindings owns household-bound service principals (#958, ADR
// 0010 section 6): which Zitadel machine user may act in which household, and
// with which scopes. Household owners and admins create, list and revoke the
// bindings; the internal membership API resolves them to the role SERVICE.
//
// A service principal is never a household member. Guard rejects it on every
// public household endpoint, and binding a subject that is a member fails.
package servicebindings

import "time"

// Binding lets the service principal PrincipalID act in HouseholdID with Scopes.
type Binding struct {
	PrincipalID string    `json:"principal_id"`
	HouseholdID string    `json:"household_id"`
	Scopes      []string  `json:"scopes"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateRequest is the body of POST /api/v1/households/{id}/service-bindings.
type CreateRequest struct {
	PrincipalID string   `json:"principal_id"`
	Scopes      []string `json:"scopes"`
}

// ListResponse is the body of GET /api/v1/households/{id}/service-bindings.
type ListResponse struct {
	Bindings []Binding `json:"bindings"`
}
