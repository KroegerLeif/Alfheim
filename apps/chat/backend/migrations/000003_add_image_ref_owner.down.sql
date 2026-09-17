DROP INDEX IF EXISTS idx_image_refs_owner;
ALTER TABLE image_refs DROP COLUMN IF EXISTS owner_user_id;
