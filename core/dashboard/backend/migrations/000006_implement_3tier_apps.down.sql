DROP TABLE IF EXISTS user_links;
DROP TABLE IF EXISTS user_preferences;

-- Recreate app_catalog as migrations 000001, 000003 and 000004 left it, so the
-- down migrations of 000004 and 000003 find the table they alter (schema only;
-- the dropped catalog rows are not restored).
CREATE TABLE IF NOT EXISTS app_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon_url TEXT DEFAULT '',
    app_url TEXT NOT NULL,
    required_role VARCHAR(50) DEFAULT 'MEMBER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category VARCHAR(50) NOT NULL DEFAULT 'internal',
    display_order INT NOT NULL DEFAULT 0,
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    is_default BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_app_catalog_active ON app_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_app_catalog_category_order ON app_catalog(category, display_order);
CREATE INDEX IF NOT EXISTS idx_app_catalog_external_status ON app_catalog(is_external, status);
