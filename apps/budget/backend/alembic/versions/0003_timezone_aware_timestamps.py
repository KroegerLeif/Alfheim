"""Store timestamps as timestamptz

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-20 21:00:00.000000

The models default their timestamps to timezone-aware UTC values (``datetime.now(UTC)``), which
asyncpg refuses to write into ``timestamp without time zone`` columns, so every insert failed on
PostgreSQL. The columns are now ``timestamptz``. Existing values were written as UTC and are
reinterpreted as such. Columns that already are ``timestamptz`` are skipped. Other dialects do not
distinguish the two types and are left alone.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TIMESTAMP_COLUMNS = (
    ("accounts", "created_at"),
    ("accounts", "updated_at"),
    ("audit_logs", "timestamp"),
    ("plans", "created_at"),
    ("plans", "updated_at"),
    ("plan_categories", "created_at"),
    ("plan_categories", "updated_at"),
    ("pots", "created_at"),
    ("pots", "updated_at"),
    ("transactions", "created_at"),
    ("transactions", "updated_at"),
)


def _set_timezone_awareness(aware: bool) -> None:
    """Convert every listed column to timestamptz (aware) or timestamp (naive UTC) where it is not already."""
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    inspector = sa.inspect(bind)
    for table, column in _TIMESTAMP_COLUMNS:
        current = next(c for c in inspector.get_columns(table) if c["name"] == column)
        if bool(getattr(current["type"], "timezone", False)) == aware:
            continue
        op.alter_column(
            table,
            column,
            existing_type=current["type"],
            type_=sa.DateTime(timezone=aware),
            existing_nullable=False,
            postgresql_using=f"\"{column}\" AT TIME ZONE 'UTC'",
        )


def upgrade() -> None:
    """Upgrade database schema."""
    _set_timezone_awareness(True)


def downgrade() -> None:
    """Downgrade database schema."""
    _set_timezone_awareness(False)
