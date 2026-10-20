"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:25:02.127148

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
        "locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["locations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_locations_household_id"), "locations", ["household_id"], unique=False)
    op.create_index("ix_locations_household_id_name", "locations", ["household_id", "name"], unique=False)
    op.create_index("ix_locations_household_id_parent_id", "locations", ["household_id", "parent_id"], unique=False)
    op.create_table(
        "provider_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("provider_name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("provider_type", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("icon_url", sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_provider_subscriptions_household_id"), "provider_subscriptions", ["household_id"], unique=False
    )
    op.create_index(
        "ix_provider_subscriptions_household_id_name",
        "provider_subscriptions",
        ["household_id", "provider_name"],
        unique=False,
    )
    op.create_table(
        "items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=True),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("media_type", sa.Enum("BOOK", "GAME", "MOVIE", "SERIES", name="mediatype"), nullable=False),
        sa.Column("author_creator", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("is_cookbook", sa.Boolean(), nullable=False),
        sa.Column("isbn_gtin", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
        sa.Column("min_players", sa.Integer(), nullable=True),
        sa.Column("max_players", sa.Integer(), nullable=True),
        sa.Column("runtime_minutes", sa.Integer(), nullable=True),
        sa.Column("fsk_rating", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("AVAILABLE", "LENT_OUT", name="lendingstatus"), nullable=False),
        sa.Column("cover_image_url", sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column("manual_s3_key", sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.Column("provider_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["provider_subscriptions.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_items_household_id"), "items", ["household_id"], unique=False)
    op.create_index("ix_items_household_id_is_cookbook", "items", ["household_id", "is_cookbook"], unique=False)
    op.create_index("ix_items_household_id_location_id", "items", ["household_id", "location_id"], unique=False)
    op.create_index("ix_items_household_id_media_type", "items", ["household_id", "media_type"], unique=False)
    op.create_index("ix_items_household_id_status", "items", ["household_id", "status"], unique=False)
    op.create_index(op.f("ix_items_is_cookbook"), "items", ["is_cookbook"], unique=False)
    op.create_index(op.f("ix_items_isbn_gtin"), "items", ["isbn_gtin"], unique=False)
    op.create_index(op.f("ix_items_location_id"), "items", ["location_id"], unique=False)
    op.create_index(op.f("ix_items_media_type"), "items", ["media_type"], unique=False)
    op.create_index(op.f("ix_items_provider_id"), "items", ["provider_id"], unique=False)
    op.create_index(op.f("ix_items_status"), "items", ["status"], unique=False)
    op.create_index(op.f("ix_items_title"), "items", ["title"], unique=False)
    op.create_table(
        "lending_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("contact_name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("status", sa.Enum("AVAILABLE", "LENT_OUT", name="lendingstatus"), nullable=False),
        sa.Column("lent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["items.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lending_records_household_id"), "lending_records", ["household_id"], unique=False)
    op.create_index(
        "ix_lending_records_household_id_item_id", "lending_records", ["household_id", "item_id"], unique=False
    )
    op.create_index(
        "ix_lending_records_household_id_status", "lending_records", ["household_id", "status"], unique=False
    )
    op.create_index(op.f("ix_lending_records_item_id"), "lending_records", ["item_id"], unique=False)
    op.create_index(op.f("ix_lending_records_status"), "lending_records", ["status"], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_lending_records_status"), table_name="lending_records")
    op.drop_index(op.f("ix_lending_records_item_id"), table_name="lending_records")
    op.drop_index("ix_lending_records_household_id_status", table_name="lending_records")
    op.drop_index("ix_lending_records_household_id_item_id", table_name="lending_records")
    op.drop_index(op.f("ix_lending_records_household_id"), table_name="lending_records")
    op.drop_table("lending_records")
    op.drop_index(op.f("ix_items_title"), table_name="items")
    op.drop_index(op.f("ix_items_status"), table_name="items")
    op.drop_index(op.f("ix_items_provider_id"), table_name="items")
    op.drop_index(op.f("ix_items_media_type"), table_name="items")
    op.drop_index(op.f("ix_items_location_id"), table_name="items")
    op.drop_index(op.f("ix_items_isbn_gtin"), table_name="items")
    op.drop_index(op.f("ix_items_is_cookbook"), table_name="items")
    op.drop_index("ix_items_household_id_status", table_name="items")
    op.drop_index("ix_items_household_id_media_type", table_name="items")
    op.drop_index("ix_items_household_id_location_id", table_name="items")
    op.drop_index("ix_items_household_id_is_cookbook", table_name="items")
    op.drop_index(op.f("ix_items_household_id"), table_name="items")
    op.drop_table("items")
    op.drop_index("ix_provider_subscriptions_household_id_name", table_name="provider_subscriptions")
    op.drop_index(op.f("ix_provider_subscriptions_household_id"), table_name="provider_subscriptions")
    op.drop_table("provider_subscriptions")
    op.drop_index("ix_locations_household_id_parent_id", table_name="locations")
    op.drop_index("ix_locations_household_id_name", table_name="locations")
    op.drop_index(op.f("ix_locations_household_id"), table_name="locations")
    op.drop_table("locations")

    # PostgreSQL keeps enum types after their tables are dropped.
    bind = op.get_bind()
    for enum_name in (
        "lendingstatus",
        "mediatype",
    ):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)
