-- Down migration for alfheim dashboard backend

DROP INDEX IF EXISTS idx_contact_categories_household;
DROP INDEX IF EXISTS idx_contacts_household;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS contact_categories;
DROP TABLE IF EXISTS app_catalog;
DROP TABLE IF EXISTS household_members;
DROP TABLE IF EXISTS households;
DROP TABLE IF EXISTS user_profiles;
