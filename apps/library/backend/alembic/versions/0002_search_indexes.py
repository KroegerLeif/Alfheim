"""PostgreSQL full-text and trigram search indexes on items

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 19:30:00.000000

Moves the ``pg_trgm`` extension and the two GIN indexes behind item search out of the former startup
hook. Every statement is idempotent, so databases that already received them at startup are
unaffected. Other dialects (SQLite in tests) have neither extension nor GIN indexes and skip it.
"""

from collections.abc import Sequence

from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    if op.get_bind().dialect.name != "postgresql":
        return

    # Trigram extension for fuzzy title search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # Trigram GIN index on item titles
    op.execute("CREATE INDEX IF NOT EXISTS ix_items_trgm_title ON items USING gin (title gin_trgm_ops)")
    # Full-text search GIN index combining title, description and author_creator
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_items_fts ON items USING gin ("
        "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(author_creator, ''))"
        ")"
    )


def downgrade() -> None:
    """Downgrade database schema."""
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS ix_items_fts")
    op.execute("DROP INDEX IF EXISTS ix_items_trgm_title")
    # The pg_trgm extension is left installed: other objects in the database may depend on it.
