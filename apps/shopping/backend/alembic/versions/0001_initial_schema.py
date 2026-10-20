"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:23:16.722382

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
        "shopping_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("brand", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("barcode", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("unit", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column("purchase_count", sa.Integer(), nullable=False),
        sa.Column("icon_tag", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("last_purchased_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shopping_history_home_id"), "shopping_history", ["home_id"], unique=False)
    op.create_table(
        "shopping_lists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_personal", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shopping_lists_home_id"), "shopping_lists", ["home_id"], unique=False)
    op.create_index(op.f("ix_shopping_lists_owner_id"), "shopping_lists", ["owner_id"], unique=False)
    op.create_table(
        "shopping_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("list_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("brand", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("barcode", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False),
        sa.Column("is_auto_generated", sa.Boolean(), nullable=False),
        sa.Column("is_synced", sa.Boolean(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["list_id"],
            ["shopping_lists.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shopping_items_barcode"), "shopping_items", ["barcode"], unique=False)
    op.create_index(op.f("ix_shopping_items_is_completed"), "shopping_items", ["is_completed"], unique=False)
    op.create_index(op.f("ix_shopping_items_is_synced"), "shopping_items", ["is_synced"], unique=False)
    op.create_index(op.f("ix_shopping_items_list_id"), "shopping_items", ["list_id"], unique=False)
    op.create_index(op.f("ix_shopping_items_name"), "shopping_items", ["name"], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_shopping_items_name"), table_name="shopping_items")
    op.drop_index(op.f("ix_shopping_items_list_id"), table_name="shopping_items")
    op.drop_index(op.f("ix_shopping_items_is_synced"), table_name="shopping_items")
    op.drop_index(op.f("ix_shopping_items_is_completed"), table_name="shopping_items")
    op.drop_index(op.f("ix_shopping_items_barcode"), table_name="shopping_items")
    op.drop_table("shopping_items")
    op.drop_index(op.f("ix_shopping_lists_owner_id"), table_name="shopping_lists")
    op.drop_index(op.f("ix_shopping_lists_home_id"), table_name="shopping_lists")
    op.drop_table("shopping_lists")
    op.drop_index(op.f("ix_shopping_history_home_id"), table_name="shopping_history")
    op.drop_table("shopping_history")
