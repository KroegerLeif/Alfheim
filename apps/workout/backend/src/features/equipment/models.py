import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, SQLModel, func


class EquipmentScope(str, enum.Enum):
    """Visibility scope of an equipment entry."""

    SYSTEM = "system"
    HOUSEHOLD = "household"
    USER = "user"


class Equipment(SQLModel, table=True):
    """Gear/equipment catalog entry, visible per its scope.

    A row is visible when scope=system (to everyone), scope=household and
    home_id matches the caller's household, or scope=user and owner_user_id
    matches the caller's user id.
    """

    __tablename__ = "equipment"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
        description="Unique identifier for this equipment entry.",
    )
    scope: EquipmentScope = Field(
        sa_column=Column(String, nullable=False, index=True),
        description="Visibility scope of this equipment entry.",
    )
    home_id: uuid.UUID | None = Field(
        default=None,
        index=True,
        description="Household this entry belongs to. Set only when scope=household.",
    )
    owner_user_id: uuid.UUID | None = Field(
        default=None,
        index=True,
        description="User this entry belongs to. Set only when scope=user.",
    )
    name: str = Field(
        min_length=1,
        max_length=100,
        nullable=False,
        description="Name of the equipment (e.g. 'Barbell', 'Adjustable Dumbbells').",
    )
    category: str | None = Field(
        default=None,
        max_length=50,
        description="Optional free-text category tag (e.g. 'barbell', 'machine').",
    )
    is_active: bool = Field(default=True, nullable=False, description="Whether this entry is currently usable.")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
        description="Timestamp of creation, stored in UTC.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        description="Timestamp of last update, stored in UTC.",
    )
