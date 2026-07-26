ALTER TABLE app_catalog ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'internal';
ALTER TABLE app_catalog ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_app_catalog_category_order ON app_catalog(category, display_order);
