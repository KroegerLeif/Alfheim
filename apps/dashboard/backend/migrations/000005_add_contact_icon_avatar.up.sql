-- Add icon and avatar_url columns to contacts table
ALTER TABLE contacts ADD COLUMN icon VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN avatar_url VARCHAR(1000) NOT NULL DEFAULT '';
