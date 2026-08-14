import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Column, Date, DateTime, Index
from sqlmodel import Field, SQLModel, func


class ChoreTemplate(SQLModel, table=True):
    """The database table model representing a chore template blueprint."""

    __tablename__ = "chore_templates"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the chore template.",
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="UUID of the home space / household this template belongs to.",
    )
    name: str = Field(
        index=True,
        min_length=1,
        max_length=150,
        description="Unique name of the chore.",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Optional detailed instructions for how to perform the chore.",
    )
    points: int = Field(
        default=10,
        description="Points awarded to the user upon completing this chore.",
    )
    is_non_cumulative: bool = Field(
        default=True,
        nullable=False,
        description="If True, missed daily instances do not stack up.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of creation in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp of last update in UTC.",
    )


# Enforce name uniqueness per household
Index(
    "uq_chore_template_name_per_home",
    ChoreTemplate.home_id,
    ChoreTemplate.name,
    unique=True,
)


class ChoreInstance(SQLModel, table=True):
    """The database table model representing a scheduled chore instance for a specific day."""

    __tablename__ = "chore_instances"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the chore instance.",
    )
    template_id: uuid.UUID = Field(
        nullable=False,
        foreign_key="chore_templates.id",
        description="Reference to the originating ChoreTemplate.",
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="UUID of the household context.",
    )
    assigned_to: uuid.UUID | None = Field(
        default=None,
        nullable=True,
        description="UUID of the user assigned to this chore instance.",
    )
    completed_by: uuid.UUID | None = Field(
        default=None,
        nullable=True,
        description="UUID of the user who completed this chore instance.",
    )
    completed_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=True,
        ),
        description="Timestamp when the chore was marked complete in UTC.",
    )
    due_date: date = Field(
        sa_column=Column(
            Date,
            nullable=False,
            index=True,
        ),
        description="The calendar date this chore instance is scheduled for.",
    )
    status: str = Field(
        default="pending",
        max_length=20,
        nullable=False,
        description="Status of the chore instance: pending, completed, missed.",
    )
    points_awarded: int = Field(
        default=0,
        description="Points actual awarded (usually matching template points upon completion).",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of creation in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp of last update in UTC.",
    )


# Prevent duplicate template instances scheduled for the exact same date
Index(
    "uq_chore_instance_template_per_date",
    ChoreInstance.template_id,
    ChoreInstance.due_date,
    unique=True,
)


class HouseholdStreak(SQLModel, table=True):
    """The database table model tracking the chore completion streak of a household."""

    __tablename__ = "household_streaks"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the streak record.",
    )
    home_id: uuid.UUID = Field(
        unique=True,
        nullable=False,
        index=True,
        description="UUID of the household context.",
    )
    current_streak: int = Field(
        default=0,
        nullable=False,
        description="Current consecutive days of full chore completion.",
    )
    longest_streak: int = Field(
        default=0,
        nullable=False,
        description="Longest achieved chore completion streak.",
    )
    last_completed_date: date | None = Field(
        default=None,
        sa_column=Column(
            Date,
            nullable=True,
        ),
        description="The last date on which all chores were completed to extend/verify streak.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
        description="Timestamp of creation in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
        description="Timestamp of last update in UTC.",
    )


class ChoreCompletionHistory(SQLModel, table=True):
    """The database table model recording historical chore task completion events."""

    __tablename__ = "chore_completion_history"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for the history entry.",
    )
    template_id: uuid.UUID = Field(
        nullable=False,
        foreign_key="chore_templates.id",
        index=True,
        description="Reference to the originating ChoreTemplate.",
    )
    instance_id: uuid.UUID = Field(
        nullable=False,
        foreign_key="chore_instances.id",
        description="Reference to the completed ChoreInstance.",
    )
    home_id: uuid.UUID = Field(
        index=True,
        nullable=False,
        description="UUID of the household context.",
    )
    completed_by: uuid.UUID = Field(
        nullable=False,
        description="UUID of the user who completed the chore.",
    )
    completed_by_name: str | None = Field(
        default=None,
        max_length=150,
        nullable=True,
        description="Display name or username of the executing user.",
    )
    completed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
        ),
        description="Timestamp when the completion was recorded in UTC.",
    )
    points_awarded: int = Field(
        default=0,
        description="Points awarded for this completion event.",
    )

