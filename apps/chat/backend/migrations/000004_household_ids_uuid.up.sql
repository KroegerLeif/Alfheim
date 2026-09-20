-- Household ids are core/household UUIDs (Sprint 2). Before this, household_id
-- came from JWT claims that Zitadel never issued, so in practice every row is
-- NULL. Values that are not UUIDs (e.g. legacy "hh-1" style claims) cannot refer
-- to a core/household household and are converted to NULL instead of failing the
-- migration. No rows are deleted.
--
-- Consequences for legacy rows:
--   * conversations with NULL household_id are no longer reachable through the
--     household-scoped API (fail closed); they stay in the table untouched.
--   * model blocks shared with a NULL household become private to their owner.

ALTER TABLE conversations
    ALTER COLUMN household_id TYPE UUID
    USING CASE
        WHEN household_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN household_id::uuid
    END;

ALTER TABLE model_blocks
    ALTER COLUMN household_id TYPE UUID
    USING CASE
        WHEN household_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN household_id::uuid
    END;

UPDATE model_blocks SET visibility = 'private' WHERE visibility = 'shared' AND household_id IS NULL;

ALTER TABLE model_blocks
    ADD CONSTRAINT model_blocks_shared_requires_household
    CHECK (visibility = 'private' OR household_id IS NOT NULL);

-- Conversations are listed per owner within the active household.
CREATE INDEX IF NOT EXISTS idx_conversations_owner_household
    ON conversations(owner_user_id, household_id, updated_at DESC);
