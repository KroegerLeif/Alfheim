import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel
from src.features.equipment.models import EquipmentScope


class EquipmentCreate(SQLModel):
    """Request schema for creating a new equipment entry.

    scope/home_id/owner_user_id are never accepted from the client — they are
    derived server-side from the authenticated household/user context and an
    explicit `scope` query/body choice validated by the service layer.
    """

    name: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    scope: EquipmentScope = Field(default=EquipmentScope.HOUSEHOLD)


class EquipmentUpdate(SQLModel):
    """Request schema for partially updating an equipment entry (PATCH)."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    is_active: bool | None = Field(default=None)


class EquipmentRead(SQLModel):
    """Response schema for an equipment entry."""

    id: uuid.UUID
    scope: EquipmentScope
    home_id: uuid.UUID | None
    owner_user_id: uuid.UUID | None
    name: str
    category: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
