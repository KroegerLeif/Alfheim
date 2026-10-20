"""Bring shopping_lists columns up to date for databases created before they existed

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 18:45:00.000000

Older installs got ``is_default``, ``is_personal`` and ``position`` through ad-hoc
``ALTER TABLE ... ADD COLUMN IF NOT EXISTS`` statements at startup, which left them nullable (or missing
entirely on a table created even earlier). The models declare them NOT NULL with a server default. This
revision adds missing columns, backfills NULLs and tightens the constraint. Databases built from the
baseline already have the final shape, so the revision is a no-op for them.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (column, type, default value)
_COLUMNS: tuple[tuple[str, sa.types.TypeEngine, bool | int], ...] = (
    ("is_default", sa.Boolean(), False),
    ("is_personal", sa.Boolean(), False),
    ("position", sa.Integer(), 0),
)


def upgrade() -> None:
    """Upgrade database schema."""
    existing = {column["name"]: column for column in sa.inspect(op.get_bind()).get_columns("shopping_lists")}
    for name, column_type, default in _COLUMNS:
        server_default = sa.text(str(default).lower())
        if name not in existing:
            op.add_column(
                "shopping_lists",
                sa.Column(name, column_type, nullable=False, server_default=server_default),
            )
        elif existing[name]["nullable"]:
            op.execute(
                sa.text(f"UPDATE shopping_lists SET {name} = :default WHERE {name} IS NULL").bindparams(default=default)
            )
            op.alter_column(
                "shopping_lists",
                name,
                existing_type=column_type,
                nullable=False,
                server_default=server_default,
            )


def downgrade() -> None:
    """Keep the columns.

    The baseline revision already defines them, so dropping them here would leave the schema in a
    state revision 0001 cannot be downgraded from, and the dropped list flags would be lost data.
    """
