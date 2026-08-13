-- Migration 000006: Implement 3-tier App & Link Management (Core, Stack, User)
-- Replaces legacy global app_catalog table with user_preferences and user_links.

DROP TABLE IF EXISTS app_catalog CASCADE;

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    hidden_app_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    icon VARCHAR(100) DEFAULT 'link',
    category VARCHAR(50) DEFAULT 'user',
    description TEXT DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_links_user ON user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
