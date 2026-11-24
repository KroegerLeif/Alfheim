-- Household-bound service principals (#958, ADR 0010 section 6). A row lets the
-- Zitadel machine user principal_id act in household_id with the listed scopes.
-- The principal is never a household member; the membership API answers for it
-- with the role SERVICE. Revocation deletes the row, so access ends on the next
-- request.
CREATE TABLE IF NOT EXISTS service_bindings (
    principal_id VARCHAR(255) NOT NULL,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_bindings_principal_household_key UNIQUE (principal_id, household_id)
);

CREATE INDEX IF NOT EXISTS idx_service_bindings_household ON service_bindings(household_id);
