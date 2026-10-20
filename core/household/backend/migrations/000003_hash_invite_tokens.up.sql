-- Invite tokens are bearer secrets: store only their SHA-256 hash so a database
-- leak or backup does not expose redeemable tokens.
--
-- Existing invites are converted in place with PostgreSQL's built-in sha256()
-- (no extension required), so invites issued before this migration stay
-- redeemable with the token their creator already holds.
ALTER TABLE household_invites ADD COLUMN token_hash VARCHAR(64);

UPDATE household_invites
SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');

ALTER TABLE household_invites ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE household_invites DROP CONSTRAINT household_invites_pkey;
ALTER TABLE household_invites ADD CONSTRAINT household_invites_pkey PRIMARY KEY (token_hash);
ALTER TABLE household_invites DROP COLUMN token;
