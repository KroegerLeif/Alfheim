"""Add shopping_items.history_logged so a purchase is counted in the history once

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15 21:30:00.000000

Every Einlagern used to log all completed, unsynced items of a list in the purchase history, so an
item Pantry did not recognize was counted again on each later sync (#628). The flag records that
the item's purchase was logged. Existing rows start as not logged: an item that already went
through a sync may be counted one more time, but none is dropped from the history.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the history_logged column unless an earlier create_all already built it."""
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("shopping_items")}
    if "history_logged" not in existing:
        op.add_column(
            "shopping_items",
            sa.Column("history_logged", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    """Drop the history_logged column."""
    op.drop_column("shopping_items", "history_logged")
