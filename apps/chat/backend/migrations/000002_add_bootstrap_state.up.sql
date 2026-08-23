-- Tracks whether the one-time ENV-based bootstrap model block has already been
-- seeded, so it never reappears after a user edits or deletes it.
CREATE TABLE IF NOT EXISTS bootstrap_state (
    key        VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
