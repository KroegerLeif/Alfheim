"""Store completion timestamps as timestamptz

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 21:00:00.000000

``completed_at`` on workout sessions and sets receives timezone-aware values (the sync service uses
``datetime.now(UTC)`` and clients send offset timestamps), which asyncpg refuses to write into
``timestamp without time zone`` columns. The columns are now ``timestamptz``. Existing values were
written as UTC and are reinterpreted as such. Columns that already are ``timestamptz`` are skipped.
Other dialects do not distinguish the two types and are left alone.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TIMESTAMP_COLUMNS = (("workout_sessions", "completed_at"), ("session_sets", "completed_at"))


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
            existing_nullable=True,
            postgresql_using=f"\"{column}\" AT TIME ZONE 'UTC'",
        )


def upgrade() -> None:
    """Upgrade database schema."""
    _set_timezone_awareness(True)


def downgrade() -> None:
    """Downgrade database schema."""
    _set_timezone_awareness(False)
