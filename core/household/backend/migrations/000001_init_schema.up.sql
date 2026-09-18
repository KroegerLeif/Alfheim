-- Initial schema for the alfheim household service (database alfheim_household).
-- Created from scratch: no data is migrated from the dashboard database.

-- Local cache of identity data for users known to Alfheim, keyed by the
-- Zitadel subject. Email is display data only (access tokens may omit it), so
-- it is neither required nor unique; the subject is the identity.
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL DEFAULT '',
    username VARCHAR(100) NOT NULL DEFAULT '',
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    owner_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    street VARCHAR(255) NOT NULL DEFAULT '',
    zip VARCHAR(20) NOT NULL DEFAULT '',
    city VARCHAR(150) NOT NULL DEFAULT '',
    country VARCHAR(150) NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_id);

CREATE TABLE IF NOT EXISTS household_members (
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'MEMBER'
        CONSTRAINT household_members_role_check CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'GUEST')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);

-- A user has at most one default household.
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_members_one_default_per_user
    ON household_members(user_id) WHERE is_default;

-- A household has exactly one OWNER membership (changed only via transfer-ownership).
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_members_one_owner_per_household
    ON household_members(household_id) WHERE role = 'OWNER';

CREATE TABLE IF NOT EXISTS household_invites (
    token VARCHAR(128) PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    inviter_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    -- Invites can never grant OWNER.
    role VARCHAR(16) NOT NULL DEFAULT 'MEMBER'
        CONSTRAINT household_invites_role_check CHECK (role IN ('ADMIN', 'MEMBER', 'GUEST')),
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INT NOT NULL DEFAULT 1 CONSTRAINT household_invites_max_uses_check CHECK (max_uses >= 1),
    uses INT NOT NULL DEFAULT 0 CONSTRAINT household_invites_uses_check CHECK (uses >= 0 AND uses <= max_uses),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household ON household_invites(household_id);
