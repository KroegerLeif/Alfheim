-- Initial schema for alfheim chat-backend

CREATE TABLE IF NOT EXISTS model_blocks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     VARCHAR(64) NOT NULL, -- Keycloak sub UUID
    household_id      VARCHAR(64),          -- NULL = private, otherwise household-scoped sharing
    visibility        VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
    provider_type     VARCHAR(50) NOT NULL, -- 'ollama' | 'openai_compatible' | 'anthropic' (future)
    display_name      VARCHAR(150) NOT NULL,
    base_url          TEXT,
    model_identifier  VARCHAR(255) NOT NULL,
    api_key_encrypted BYTEA,                -- AES-256-GCM ciphertext, NULL when the provider needs no key
    api_key_key_id    VARCHAR(50) NOT NULL DEFAULT 'v1', -- encryption key version, enables future rotation
    config_json       JSONB NOT NULL DEFAULT '{}'::jsonb, -- temperature, context window, allowed_mcp_apps, tool_round_limit
    health_status     VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('ok', 'unreachable', 'auth_invalid', 'unknown')),
    health_checked_at TIMESTAMPTZ,
    health_detail     TEXT,
    is_bootstrap      BOOLEAN NOT NULL DEFAULT FALSE, -- seeded from CHAT_BOOTSTRAP_* env vars on first startup
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_server_registry (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_slug          VARCHAR(100) NOT NULL UNIQUE, -- 'pantry', 'chores', 'maintenance'
    internal_url      TEXT NOT NULL,                 -- e.g. http://pantry-backend:8000/mcp
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    last_discovery_at TIMESTAMPTZ,
    last_tools_json   JSONB,                         -- cached list_tools() result for UI/debug
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     VARCHAR(64) NOT NULL,
    household_id      VARCHAR(64),
    source_app        VARCHAR(100), -- e.g. 'pantry'; NULL when opened from the full chat app
    source_context    JSONB,        -- host-supplied context (entity type/id, etc.)
    model_block_id    UUID REFERENCES model_blocks(id) ON DELETE SET NULL,
    title             VARCHAR(255),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role              VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content           TEXT,
    tool_calls_json   JSONB,        -- tool call requests/results for this turn (audit & replay)
    mcp_server_id     UUID REFERENCES mcp_server_registry(id) ON DELETE SET NULL,
    token_usage_json  JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_refs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        UUID REFERENCES messages(id) ON DELETE CASCADE,
    storage_key       TEXT NOT NULL, -- RustFS object key, e.g. households/{id}/chat/{filename}
    mime_type         VARCHAR(100) NOT NULL,
    size_bytes        BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_blocks_owner ON model_blocks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_model_blocks_household_shared ON model_blocks(household_id) WHERE visibility = 'shared';
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_household ON conversations(household_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_image_refs_message ON image_refs(message_id);
