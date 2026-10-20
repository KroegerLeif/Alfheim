"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:23:47.991042

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        "device",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("model", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("serial", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("category", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("location", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("service_interval_months", sa.Integer(), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_device_household_id"), "device", ["household_id"], unique=False)
    op.create_table(
        "maintenancestep",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("recurrence", sa.Integer(), nullable=False),
        sa.Column("supply_item", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("supply_needed_date", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("last_completed", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["device.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "servicehistoryevent",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("performer", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("completed_steps", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["device.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table("servicehistoryevent")
    op.drop_table("maintenancestep")
    op.drop_index(op.f("ix_device_household_id"), table_name="device")
    op.drop_table("device")
