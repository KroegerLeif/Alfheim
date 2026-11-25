-- Reverts migration 000010.
DROP TABLE IF EXISTS integration_webhooks;
DROP INDEX IF EXISTS idx_integration_events_household_received;
DROP TABLE IF EXISTS integration_events;
DROP TABLE IF EXISTS integration_rules;
