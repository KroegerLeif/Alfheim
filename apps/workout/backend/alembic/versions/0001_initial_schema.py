"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-20 22:21:24.690749

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
        "equipment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.String(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("category", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_equipment_home_id"), "equipment", ["home_id"], unique=False)
    op.create_index(op.f("ix_equipment_owner_user_id"), "equipment", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_equipment_scope"), "equipment", ["scope"], unique=False)
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plans_home_id"), "plans", ["home_id"], unique=False)
    op.create_index(op.f("ix_plans_is_shared"), "plans", ["is_shared"], unique=False)
    op.create_index(op.f("ix_plans_owner_user_id"), "plans", ["owner_user_id"], unique=False)
    op.create_table(
        "exercises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.String(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("primary_muscle", sa.String(), nullable=False),
        sa.Column("secondary_muscles", sa.JSON(), nullable=True),
        sa.Column("equipment_id", sa.Uuid(), nullable=True),
        sa.Column("default_unit", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
        sa.Column("instructions", sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exercises_equipment_id"), "exercises", ["equipment_id"], unique=False)
    op.create_index(op.f("ix_exercises_home_id"), "exercises", ["home_id"], unique=False)
    op.create_index(op.f("ix_exercises_owner_user_id"), "exercises", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_exercises_primary_muscle"), "exercises", ["primary_muscle"], unique=False)
    op.create_index(op.f("ix_exercises_scope"), "exercises", ["scope"], unique=False)
    op.create_table(
        "plan_days",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=True),
        sa.Column("day_order", sa.Integer(), nullable=False),
        sa.Column("label", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["plans.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plan_days_plan_id"), "plan_days", ["plan_id"], unique=False)
    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=True),
        sa.Column("plan_day_label", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workout_sessions_home_id"), "workout_sessions", ["home_id"], unique=False)
    op.create_index(op.f("ix_workout_sessions_plan_id"), "workout_sessions", ["plan_id"], unique=False)
    op.create_index(op.f("ix_workout_sessions_status"), "workout_sessions", ["status"], unique=False)
    op.create_index(op.f("ix_workout_sessions_user_id"), "workout_sessions", ["user_id"], unique=False)
    op.create_table(
        "exercise_favorites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exercise_favorites_exercise_id"), "exercise_favorites", ["exercise_id"], unique=False)
    op.create_index(op.f("ix_exercise_favorites_home_id"), "exercise_favorites", ["home_id"], unique=False)
    op.create_index(op.f("ix_exercise_favorites_user_id"), "exercise_favorites", ["user_id"], unique=False)
    op.create_index("uq_user_exercise_favorite", "exercise_favorites", ["user_id", "exercise_id"], unique=True)
    op.create_table(
        "plan_exercises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_day_id", sa.Uuid(), nullable=True),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
        ),
        sa.ForeignKeyConstraint(
            ["plan_day_id"],
            ["plan_days.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plan_exercises_exercise_id"), "plan_exercises", ["exercise_id"], unique=False)
    op.create_index(op.f("ix_plan_exercises_plan_day_id"), "plan_exercises", ["plan_day_id"], unique=False)
    op.create_table(
        "session_exercises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_name_snapshot", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("primary_muscle_snapshot", sa.String(), nullable=False),
        sa.Column("exercise_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["workout_sessions.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_session_exercises_exercise_id"), "session_exercises", ["exercise_id"], unique=False)
    op.create_index(op.f("ix_session_exercises_session_id"), "session_exercises", ["session_id"], unique=False)
    op.create_table(
        "user_exercise_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("home_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("default_target_weight_kg", sa.Float(), nullable=True),
        sa.Column("preferred_unit", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_exercise_preferences_exercise_id"), "user_exercise_preferences", ["exercise_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_exercise_preferences_home_id"), "user_exercise_preferences", ["home_id"], unique=False
    )
    op.create_index(
        op.f("ix_user_exercise_preferences_user_id"), "user_exercise_preferences", ["user_id"], unique=False
    )
    op.create_index("uq_user_exercise_pref", "user_exercise_preferences", ["user_id", "exercise_id"], unique=True)
    op.create_table(
        "plan_sets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_exercise_id", sa.Uuid(), nullable=True),
        sa.Column("set_order", sa.Integer(), nullable=False),
        sa.Column("target_reps", sa.Integer(), nullable=True),
        sa.Column("target_weight_type", sa.String(), nullable=False),
        sa.Column("target_weight_kg", sa.Float(), nullable=True),
        sa.Column("offset_kg", sa.Float(), nullable=True),
        sa.Column("is_warmup", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["plan_exercise_id"],
            ["plan_exercises.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plan_sets_plan_exercise_id"), "plan_sets", ["plan_exercise_id"], unique=False)
    op.create_table(
        "session_sets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_exercise_id", sa.Uuid(), nullable=True),
        sa.Column("set_order", sa.Integer(), nullable=False),
        sa.Column("target_reps", sa.Integer(), nullable=True),
        sa.Column("target_weight_kg", sa.Float(), nullable=True),
        sa.Column("actual_reps", sa.Integer(), nullable=True),
        sa.Column("actual_weight_kg", sa.Float(), nullable=True),
        sa.Column("is_warmup", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("client_idempotency_key", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_exercise_id"],
            ["session_exercises.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_session_sets_client_idempotency_key"), "session_sets", ["client_idempotency_key"], unique=False
    )
    op.create_index(op.f("ix_session_sets_session_exercise_id"), "session_sets", ["session_exercise_id"], unique=False)
    op.create_index(
        "uq_session_set_idempotency",
        "session_sets",
        ["session_exercise_id", "client_idempotency_key"],
        unique=True,
        postgresql_where=sa.text("client_idempotency_key IS NOT NULL"),
        sqlite_where=sa.text("client_idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(
        "uq_session_set_idempotency",
        table_name="session_sets",
        postgresql_where=sa.text("client_idempotency_key IS NOT NULL"),
        sqlite_where=sa.text("client_idempotency_key IS NOT NULL"),
    )
    op.drop_index(op.f("ix_session_sets_session_exercise_id"), table_name="session_sets")
    op.drop_index(op.f("ix_session_sets_client_idempotency_key"), table_name="session_sets")
    op.drop_table("session_sets")
    op.drop_index(op.f("ix_plan_sets_plan_exercise_id"), table_name="plan_sets")
    op.drop_table("plan_sets")
    op.drop_index("uq_user_exercise_pref", table_name="user_exercise_preferences")
    op.drop_index(op.f("ix_user_exercise_preferences_user_id"), table_name="user_exercise_preferences")
    op.drop_index(op.f("ix_user_exercise_preferences_home_id"), table_name="user_exercise_preferences")
    op.drop_index(op.f("ix_user_exercise_preferences_exercise_id"), table_name="user_exercise_preferences")
    op.drop_table("user_exercise_preferences")
    op.drop_index(op.f("ix_session_exercises_session_id"), table_name="session_exercises")
    op.drop_index(op.f("ix_session_exercises_exercise_id"), table_name="session_exercises")
    op.drop_table("session_exercises")
    op.drop_index(op.f("ix_plan_exercises_plan_day_id"), table_name="plan_exercises")
    op.drop_index(op.f("ix_plan_exercises_exercise_id"), table_name="plan_exercises")
    op.drop_table("plan_exercises")
    op.drop_index("uq_user_exercise_favorite", table_name="exercise_favorites")
    op.drop_index(op.f("ix_exercise_favorites_user_id"), table_name="exercise_favorites")
    op.drop_index(op.f("ix_exercise_favorites_home_id"), table_name="exercise_favorites")
    op.drop_index(op.f("ix_exercise_favorites_exercise_id"), table_name="exercise_favorites")
    op.drop_table("exercise_favorites")
    op.drop_index(op.f("ix_workout_sessions_user_id"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_status"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_plan_id"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_home_id"), table_name="workout_sessions")
    op.drop_table("workout_sessions")
    op.drop_index(op.f("ix_plan_days_plan_id"), table_name="plan_days")
    op.drop_table("plan_days")
    op.drop_index(op.f("ix_exercises_scope"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_primary_muscle"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_owner_user_id"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_home_id"), table_name="exercises")
    op.drop_index(op.f("ix_exercises_equipment_id"), table_name="exercises")
    op.drop_table("exercises")
    op.drop_index(op.f("ix_plans_owner_user_id"), table_name="plans")
    op.drop_index(op.f("ix_plans_is_shared"), table_name="plans")
    op.drop_index(op.f("ix_plans_home_id"), table_name="plans")
    op.drop_table("plans")
    op.drop_index(op.f("ix_equipment_scope"), table_name="equipment")
    op.drop_index(op.f("ix_equipment_owner_user_id"), table_name="equipment")
    op.drop_index(op.f("ix_equipment_home_id"), table_name="equipment")
    op.drop_table("equipment")
