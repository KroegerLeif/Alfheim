"""Scope product barcode uniqueness to the household and the shared catalog

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 18:30:00.000000

Databases created by ``create_all`` before barcodes became household-local carry a globally unique
``ix_products_barcode`` index. This revision replaces it with a plain lookup index and adds the two
scoped unique indexes: ``(home_id, barcode)`` for household products and a partial unique index on
``barcode`` for the shared catalog (``is_global``). Databases built from the baseline already have
this shape, so every step checks the current state first and the revision is a no-op for them.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _product_indexes() -> dict[str, dict]:
    return {index["name"]: index for index in sa.inspect(op.get_bind()).get_indexes("products")}


def upgrade() -> None:
    """Upgrade database schema."""
    indexes = _product_indexes()

    if indexes.get("ix_products_barcode", {}).get("unique"):
        op.drop_index("ix_products_barcode", table_name="products")
        op.create_index("ix_products_barcode", "products", ["barcode"], unique=False)

    if "uq_products_home_barcode" not in indexes:
        op.create_index("uq_products_home_barcode", "products", ["home_id", "barcode"], unique=True)

    if "uq_products_global_barcode" not in indexes:
        op.create_index(
            "uq_products_global_barcode",
            "products",
            ["barcode"],
            unique=True,
            postgresql_where=sa.text("is_global"),
            sqlite_where=sa.text("is_global"),
        )


def downgrade() -> None:
    """Keep the scoped barcode indexes.

    The baseline revision already defines them, so removing them here would leave the schema in a
    state revision 0001 cannot be downgraded from. Restoring the old global unique index is not
    attempted either: it would fail as soon as two households hold the same barcode.
    """
