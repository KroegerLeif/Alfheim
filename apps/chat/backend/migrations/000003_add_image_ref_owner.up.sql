-- Records which user uploaded an attachment so reads and message links can be
-- restricted to the uploader. Rows created before this migration stay NULL and
-- are treated as owned by nobody (fail closed).
ALTER TABLE image_refs ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_image_refs_owner ON image_refs(owner_user_id);
