"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 17:55:08.808357

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
        "accounts",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "account_type",
            sa.Enum("CHECKING", "SAVINGS", "BUILDING_SAVINGS", "INVESTMENT", name="accounttype"),
            nullable=False,
        ),
        sa.Column("balance", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(length=3), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accounts_account_type"), "accounts", ["account_type"], unique=False)
    op.create_index(op.f("ix_accounts_household_id"), "accounts", ["household_id"], unique=False)
    op.create_index(op.f("ix_accounts_name"), "accounts", ["name"], unique=False)
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entity_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_name"), "audit_logs", ["entity_name"], unique=False)
    op.create_index(op.f("ix_audit_logs_household_id"), "audit_logs", ["household_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_table(
        "plans",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("plan_type", sa.Enum("MONTHLY", "EVENT", name="plantype"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("total_budget", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plans_household_id"), "plans", ["household_id"], unique=False)
    op.create_index(op.f("ix_plans_name"), "plans", ["name"], unique=False)
    op.create_index(op.f("ix_plans_plan_type"), "plans", ["plan_type"], unique=False)
    op.create_table(
        "pots",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("current_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("monthly_contribution", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "overflow_target", sa.Enum("CASCADE", "UNASSIGNED", "INVESTMENT", name="overflowtarget"), nullable=False
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pots_household_id"), "pots", ["household_id"], unique=False)
    op.create_index(op.f("ix_pots_name"), "pots", ["name"], unique=False)
    op.create_index(op.f("ix_pots_priority"), "pots", ["priority"], unique=False)
    op.create_table(
        "plan_categories",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("allocated_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["plan_categories.id"],
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["plans.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plan_categories_household_id"), "plan_categories", ["household_id"], unique=False)
    op.create_index(op.f("ix_plan_categories_name"), "plan_categories", ["name"], unique=False)
    op.create_index(op.f("ix_plan_categories_parent_id"), "plan_categories", ["parent_id"], unique=False)
    op.create_index(op.f("ix_plan_categories_plan_id"), "plan_categories", ["plan_id"], unique=False)
    op.create_table(
        "transactions",
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(length=3), nullable=False),
        sa.Column("transaction_type", sa.Enum("EXPENSE", "INCOME", "TRANSFER", name="transactiontype"), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("pot_id", sa.Uuid(), nullable=True),
        sa.Column("plan_id", sa.Uuid(), nullable=True),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("receipt_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("is_quick_add", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["plan_categories.id"],
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["plans.id"],
        ),
        sa.ForeignKeyConstraint(["pot_id"], ["pots.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_transactions_account_id"), "transactions", ["account_id"], unique=False)
    op.create_index(op.f("ix_transactions_category_id"), "transactions", ["category_id"], unique=False)
    op.create_index(op.f("ix_transactions_description"), "transactions", ["description"], unique=False)
    op.create_index(op.f("ix_transactions_household_id"), "transactions", ["household_id"], unique=False)
    op.create_index(op.f("ix_transactions_plan_id"), "transactions", ["plan_id"], unique=False)
    op.create_index(op.f("ix_transactions_pot_id"), "transactions", ["pot_id"], unique=False)
    op.create_index(op.f("ix_transactions_transaction_type"), "transactions", ["transaction_type"], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_transactions_transaction_type"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_pot_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_plan_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_household_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_description"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_category_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_account_id"), table_name="transactions")
    op.drop_table("transactions")
    op.drop_index(op.f("ix_plan_categories_plan_id"), table_name="plan_categories")
    op.drop_index(op.f("ix_plan_categories_parent_id"), table_name="plan_categories")
    op.drop_index(op.f("ix_plan_categories_name"), table_name="plan_categories")
    op.drop_index(op.f("ix_plan_categories_household_id"), table_name="plan_categories")
    op.drop_table("plan_categories")
    op.drop_index(op.f("ix_pots_priority"), table_name="pots")
    op.drop_index(op.f("ix_pots_name"), table_name="pots")
    op.drop_index(op.f("ix_pots_household_id"), table_name="pots")
    op.drop_table("pots")
    op.drop_index(op.f("ix_plans_plan_type"), table_name="plans")
    op.drop_index(op.f("ix_plans_name"), table_name="plans")
    op.drop_index(op.f("ix_plans_household_id"), table_name="plans")
    op.drop_table("plans")
    op.drop_index(op.f("ix_audit_logs_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_timestamp"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_household_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_name"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(op.f("ix_accounts_name"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_household_id"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_account_type"), table_name="accounts")
    op.drop_table("accounts")

    # PostgreSQL keeps enum types after their tables are dropped.
    bind = op.get_bind()
    for enum_name in (
        "transactiontype",
        "overflowtarget",
        "plantype",
        "accounttype",
    ):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)
