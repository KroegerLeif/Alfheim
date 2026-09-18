-- Migration 000007: Households, members, invites and contacts moved to core/household.
-- The dashboard no longer owns this data, so its copies of these tables are dropped.
-- user_profiles stays: user_preferences and user_links reference it by foreign key,
-- and the dashboard provisions a minimal row per user Just-In-Time.

DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS contact_categories;
DROP TABLE IF EXISTS household_invites;
DROP TABLE IF EXISTS household_members;
DROP TABLE IF EXISTS households;
