-- Migration 000009: typed plugins per household (#956, ADR 0010).
-- One row per household and plugin type. Credentials are AES-256-GCM ciphertext
-- (INTEGRATIONS_ENCRYPTION_KEY); credentials_key_id names the key that sealed
-- them, so keys can be rotated. household_id comes from the core/household
-- membership check; there is no foreign key because households live in
-- core/household's database.

CREATE TABLE IF NOT EXISTS household_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    type VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    base_url VARCHAR(2048) NOT NULL DEFAULT '',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    credentials_encrypted BYTEA,
    credentials_key_id VARCHAR(64) NOT NULL DEFAULT '',
    health_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    health_checked_at TIMESTAMPTZ,
    health_detail VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_household_plugins_household_type UNIQUE (household_id, type)
);
