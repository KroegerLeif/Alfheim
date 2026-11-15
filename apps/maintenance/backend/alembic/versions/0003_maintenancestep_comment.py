"""Add maintenancestep.comment so an inspection note no longer replaces the procedure

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15 21:45:00.000000

The inspection comment of a scheduled task used to be written into ``maintenancestep.description``,
which destroyed the procedure text the step was created with (#620). The note gets its own nullable
column. Existing descriptions stay where they are: whether one was a procedure or an earlier comment
cannot be told apart, so none is moved.
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the comment column unless an earlier create_all already built it."""
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("maintenancestep")}
    if "comment" not in existing:
        op.add_column("maintenancestep", sa.Column("comment", sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    """Drop the comment column."""
    op.drop_column("maintenancestep", "comment")
