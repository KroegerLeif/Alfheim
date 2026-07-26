DROP INDEX IF EXISTS idx_app_catalog_external_status;
ALTER TABLE app_catalog DROP COLUMN IF EXISTS is_external;
ALTER TABLE app_catalog DROP COLUMN IF EXISTS status;
ALTER TABLE app_catalog DROP COLUMN IF EXISTS is_default;
