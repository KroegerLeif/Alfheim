"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:22:07.400685

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
        "categories",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("is_global", sa.Boolean(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("home_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_categories_name"), "categories", ["name"], unique=False)
    op.create_table(
        "locations",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("home_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_locations_name"), "locations", ["name"], unique=False)
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("brand", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("barcode", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("image_url", sqlmodel.sql.sqltypes.AutoString(length=2048), nullable=True),
        sa.Column("base_unit", sa.String(), nullable=False),
        sa.Column("is_global", sa.Boolean(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=True),
        sa.Column("minimum_stock", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_products_barcode"), "products", ["barcode"], unique=False)
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"], unique=False)
    op.create_index(op.f("ix_products_home_id"), "products", ["home_id"], unique=False)
    op.create_index(op.f("ix_products_is_global"), "products", ["is_global"], unique=False)
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=False)
    op.create_index(
        "uq_products_global_barcode",
        "products",
        ["barcode"],
        unique=True,
        postgresql_where=sa.text("is_global"),
        sqlite_where=sa.text("is_global"),
    )
    op.create_index("uq_products_home_barcode", "products", ["home_id", "barcode"], unique=True)
    op.create_table(
        "inventory_ledger",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_type", sa.String(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("quantity_input", sa.Float(), nullable=False),
        sa.Column("unit_input", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column("batch_code", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_ledger_batch_code"), "inventory_ledger", ["batch_code"], unique=False)
    op.create_index(op.f("ix_inventory_ledger_expiration_date"), "inventory_ledger", ["expiration_date"], unique=False)
    op.create_index(op.f("ix_inventory_ledger_location_id"), "inventory_ledger", ["location_id"], unique=False)
    op.create_index(op.f("ix_inventory_ledger_product_id"), "inventory_ledger", ["product_id"], unique=False)
    op.create_table(
        "inventory_state",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("batch_code", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("expiration_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_state_batch_code"), "inventory_state", ["batch_code"], unique=False)
    op.create_index(op.f("ix_inventory_state_expiration_date"), "inventory_state", ["expiration_date"], unique=False)
    op.create_index(op.f("ix_inventory_state_location_id"), "inventory_state", ["location_id"], unique=False)
    op.create_index(op.f("ix_inventory_state_product_id"), "inventory_state", ["product_id"], unique=False)
    op.create_table(
        "product_nutrition",
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("fat", sa.Float(), nullable=True),
        sa.Column("saturated_fat", sa.Float(), nullable=True),
        sa.Column("carbohydrates", sa.Float(), nullable=True),
        sa.Column("sugars", sa.Float(), nullable=True),
        sa.Column("protein", sa.Float(), nullable=True),
        sa.Column("salt", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("product_id"),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table("product_nutrition")
    op.drop_index(op.f("ix_inventory_state_product_id"), table_name="inventory_state")
    op.drop_index(op.f("ix_inventory_state_location_id"), table_name="inventory_state")
    op.drop_index(op.f("ix_inventory_state_expiration_date"), table_name="inventory_state")
    op.drop_index(op.f("ix_inventory_state_batch_code"), table_name="inventory_state")
    op.drop_table("inventory_state")
    op.drop_index(op.f("ix_inventory_ledger_product_id"), table_name="inventory_ledger")
    op.drop_index(op.f("ix_inventory_ledger_location_id"), table_name="inventory_ledger")
    op.drop_index(op.f("ix_inventory_ledger_expiration_date"), table_name="inventory_ledger")
    op.drop_index(op.f("ix_inventory_ledger_batch_code"), table_name="inventory_ledger")
    op.drop_table("inventory_ledger")
    op.drop_index("uq_products_home_barcode", table_name="products")
    op.drop_index(
        "uq_products_global_barcode",
        table_name="products",
        postgresql_where=sa.text("is_global"),
        sqlite_where=sa.text("is_global"),
    )
    op.drop_index(op.f("ix_products_name"), table_name="products")
    op.drop_index(op.f("ix_products_is_global"), table_name="products")
    op.drop_index(op.f("ix_products_home_id"), table_name="products")
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_index(op.f("ix_products_barcode"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_locations_name"), table_name="locations")
    op.drop_table("locations")
    op.drop_index(op.f("ix_categories_name"), table_name="categories")
    op.drop_table("categories")
