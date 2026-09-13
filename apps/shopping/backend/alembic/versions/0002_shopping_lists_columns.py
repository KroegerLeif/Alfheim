"""Add missing shopping_lists columns

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-01 00:00:00.000000

This migration adds columns that were previously added ad-hoc in the
database initialization logic. These columns enable new features for
shopping lists (default/personal status and positioning).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "shopping_lists",
        sa.Column("is_default", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    )
    op.add_column(
        "shopping_lists",
        sa.Column("is_personal", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    )
    op.add_column(
        "shopping_lists",
        sa.Column("position", sa.Integer(), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("shopping_lists", "position")
    op.drop_column("shopping_lists", "is_personal")
    op.drop_column("shopping_lists", "is_default")
