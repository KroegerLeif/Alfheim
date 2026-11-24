-- Migration 000008: household-managed external app launchers (#955, ADR 0010).
-- A launcher is a link and nothing else: no credentials, no backend call to the
-- target. household_id comes from the core/household membership check; there is
-- no foreign key because households live in core/household's database.

CREATE TABLE IF NOT EXISTS household_launchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT 'link',
    description VARCHAR(500) NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_launchers_household ON household_launchers(household_id);
