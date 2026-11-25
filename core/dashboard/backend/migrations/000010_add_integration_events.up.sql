-- Migration 000010: inbound plugin events, action rules and webhook secrets
-- (#960, ADR 0010). household_id always comes from the plugin row the webhook
-- id names, never from an event payload.

-- Rules map an event type of a plugin type to an action, per household.
CREATE TABLE IF NOT EXISTS integration_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    plugin_type VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_rules_event UNIQUE (household_id, plugin_type, event_type)
);

-- Every received event, for idempotency (event_id is unique per plugin row)
-- and the audit list.
CREATE TABLE IF NOT EXISTS integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES household_plugins (id) ON DELETE CASCADE,
    household_id UUID NOT NULL,
    event_id VARCHAR(200) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'received',
    action VARCHAR(64) NOT NULL DEFAULT '',
    detail VARCHAR(500) NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_events_plugin_event UNIQUE (plugin_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_events_household_received
    ON integration_events (household_id, received_at DESC);

-- The HMAC secret of a plugin's webhook, AES-256-GCM sealed with
-- INTEGRATIONS_ENCRYPTION_KEY like plugin credentials.
CREATE TABLE IF NOT EXISTS integration_webhooks (
    plugin_id UUID PRIMARY KEY REFERENCES household_plugins (id) ON DELETE CASCADE,
    household_id UUID NOT NULL,
    secret_encrypted BYTEA NOT NULL,
    secret_key_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
