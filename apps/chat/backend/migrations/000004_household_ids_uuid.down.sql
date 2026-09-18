DROP INDEX IF EXISTS idx_conversations_owner_household;

ALTER TABLE model_blocks DROP CONSTRAINT IF EXISTS model_blocks_shared_requires_household;

ALTER TABLE model_blocks
    ALTER COLUMN household_id TYPE VARCHAR(64) USING household_id::text;

ALTER TABLE conversations
    ALTER COLUMN household_id TYPE VARCHAR(64) USING household_id::text;
