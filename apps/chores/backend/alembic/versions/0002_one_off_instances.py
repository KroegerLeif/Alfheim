"""one-off chore instances with idempotency keys (#959)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


UNIQUE_KEY = "uq_chore_instance_idempotency_key"


def upgrade() -> None:
    """Add the one-off marker and the per-household idempotency key unless an earlier create_all built them."""
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("chore_instances")}
    constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("chore_instances")}
    if {"is_one_off", "idempotency_key"} <= columns and UNIQUE_KEY in constraints:
        return
    # Batch mode, because SQLite cannot add a unique constraint to an existing table.
    with op.batch_alter_table("chore_instances") as batch:
        if "is_one_off" not in columns:
            batch.add_column(sa.Column("is_one_off", sa.Boolean(), server_default=sa.false(), nullable=False))
        if "idempotency_key" not in columns:
            batch.add_column(sa.Column("idempotency_key", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True))
        if UNIQUE_KEY not in constraints:
            batch.create_unique_constraint(UNIQUE_KEY, ["home_id", "idempotency_key"])


def downgrade() -> None:
    """Drop the one-off marker and the idempotency key."""
    with op.batch_alter_table("chore_instances") as batch:
        batch.drop_constraint(UNIQUE_KEY, type_="unique")
        batch.drop_column("idempotency_key")
        batch.drop_column("is_one_off")
