"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:18:21.445347

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
        "chore_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("is_non_cumulative", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chore_templates_home_id"), "chore_templates", ["home_id"], unique=False)
    op.create_index(op.f("ix_chore_templates_name"), "chore_templates", ["name"], unique=False)
    op.create_table(
        "household_streaks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("longest_streak", sa.Integer(), nullable=False),
        sa.Column("last_completed_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_household_streaks_home_id"), "household_streaks", ["home_id"], unique=True)
    op.create_table(
        "chore_instances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_to", sa.Uuid(), nullable=True),
        sa.Column("completed_by", sa.Uuid(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["chore_templates.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chore_instances_due_date"), "chore_instances", ["due_date"], unique=False)
    op.create_index(op.f("ix_chore_instances_home_id"), "chore_instances", ["home_id"], unique=False)
    op.create_table(
        "chore_completion_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("instance_id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("completed_by", sa.Uuid(), nullable=False),
        sa.Column("completed_by_name", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["instance_id"],
            ["chore_instances.id"],
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["chore_templates.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chore_completion_history_home_id"), "chore_completion_history", ["home_id"], unique=False)
    op.create_index(
        op.f("ix_chore_completion_history_template_id"), "chore_completion_history", ["template_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_chore_completion_history_template_id"), table_name="chore_completion_history")
    op.drop_index(op.f("ix_chore_completion_history_home_id"), table_name="chore_completion_history")
    op.drop_table("chore_completion_history")
    op.drop_index(op.f("ix_chore_instances_home_id"), table_name="chore_instances")
    op.drop_index(op.f("ix_chore_instances_due_date"), table_name="chore_instances")
    op.drop_table("chore_instances")
    op.drop_index(op.f("ix_household_streaks_home_id"), table_name="household_streaks")
    op.drop_table("household_streaks")
    op.drop_index(op.f("ix_chore_templates_name"), table_name="chore_templates")
    op.drop_index(op.f("ix_chore_templates_home_id"), table_name="chore_templates")
    op.drop_table("chore_templates")
