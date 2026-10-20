"""Move the pre-UUID integer-household schema out of the way

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 19:00:00.000000

Before households became UUIDs owned by core/household, the service kept a local ``household`` table
and an integer ``device.household_id``. Integer household ids cannot be mapped to UUID households, so
the old rows cannot be converted automatically, but they must not be lost either. On such a database
this revision moves the four legacy tables into the ``legacy_maintenance`` schema (rows, indexes and
constraints intact, available for a manual re-import) and creates the current tables again from the
baseline revision. Databases that already use UUID households are left untouched.
"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from alembic.script import ScriptDirectory

# Revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

logger = logging.getLogger("alembic.runtime.migration")

LEGACY_SCHEMA = "legacy_maintenance"
# Dependants first is irrelevant for SET SCHEMA; the foreign keys between these tables move along.
LEGACY_TABLES = ("servicehistoryevent", "maintenancestep", "device", "household")


def _is_legacy_schema(inspector: sa.Inspector) -> bool:
    """Return True when the database still has the local household table or an integer device.household_id."""
    tables = set(inspector.get_table_names())
    if "household" in tables:
        return True
    if "device" in tables:
        household_id = next((c for c in inspector.get_columns("device") if c["name"] == "household_id"), None)
        return household_id is not None and isinstance(household_id["type"], sa.Integer)
    return False


def upgrade() -> None:
    """Upgrade database schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not _is_legacy_schema(inspector):
        return
    if bind.dialect.name != "postgresql":
        raise RuntimeError(
            "The maintenance database uses the legacy integer household schema, which can only be moved aside "
            "on PostgreSQL. Drop the tables device, maintenancestep, servicehistoryevent and household and restart."
        )

    present = [table for table in LEGACY_TABLES if inspector.has_table(table)]
    op.execute(sa.text(f"CREATE SCHEMA IF NOT EXISTS {LEGACY_SCHEMA}"))
    for table in present:
        op.execute(sa.text(f'ALTER TABLE "{table}" SET SCHEMA {LEGACY_SCHEMA}'))
    logger.warning(
        "Moved legacy integer-household tables %s into schema %s; their rows are kept but not served.",
        ", ".join(present),
        LEGACY_SCHEMA,
    )

    # Recreate the current tables exactly as the baseline defines them.
    baseline = ScriptDirectory.from_config(op.get_context().config).get_revision("0001")
    baseline.module.upgrade()


def downgrade() -> None:
    """Keep the schema.

    Moving the legacy tables back would collide with the current tables of the same names, and the baseline
    revision this one sits on already describes the current schema.
    """
