-- Plaintext tokens cannot be recovered from their hashes. Rolling back restores
-- the original column layout; existing invites are deleted because they would
-- otherwise linger unredeemable (their token value would be the hash).
DELETE FROM household_invites;

ALTER TABLE household_invites DROP CONSTRAINT household_invites_pkey;
ALTER TABLE household_invites RENAME COLUMN token_hash TO token;
ALTER TABLE household_invites ALTER COLUMN token TYPE VARCHAR(128);
ALTER TABLE household_invites ADD CONSTRAINT household_invites_pkey PRIMARY KEY (token);
