"""Restrict deleting accounts and pots that transactions still reference

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 18:00:00.000000

Databases created by ``create_all`` before ``ondelete="RESTRICT"`` was added to the models have
transactions.account_id / transactions.pot_id foreign keys without a delete rule. This revision
recreates those constraints with the rule. Databases built from the baseline already have it, so
the revision is a no-op for them.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (column on transactions, referenced table)
_RESTRICTED_REFERENCES = (("account_id", "accounts"), ("pot_id", "pots"))


def _set_delete_rule(column: str, referred_table: str, ondelete: str | None) -> None:
    """Make transactions.<column> reference <referred_table>.id with the given delete rule."""
    # PostgreSQL's default name for the unnamed foreign keys that create_all and the baseline emit.
    constraint_name = f"transactions_{column}_fkey"
    for foreign_key in sa.inspect(op.get_bind()).get_foreign_keys("transactions"):
        if foreign_key["constrained_columns"] != [column]:
            continue
        if (foreign_key.get("options") or {}).get("ondelete") == ondelete:
            return
        op.drop_constraint(foreign_key["name"] or constraint_name, "transactions", type_="foreignkey")
    op.create_foreign_key(
        constraint_name,
        "transactions",
        referred_table,
        [column],
        ["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    """Upgrade database schema."""
    for column, referred_table in _RESTRICTED_REFERENCES:
        _set_delete_rule(column, referred_table, "RESTRICT")


def downgrade() -> None:
    """Downgrade database schema."""
    for column, referred_table in _RESTRICTED_REFERENCES:
        _set_delete_rule(column, referred_table, None)
