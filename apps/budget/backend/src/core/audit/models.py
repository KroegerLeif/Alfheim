"""Audit log model definitions."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    """Immutable record of an insert, update, or delete operation on an entity."""

    __tablename__ = "audit_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    household_id: uuid.UUID | None = Field(default=None, index=True)
    user_id: uuid.UUID | None = Field(default=None, index=True)
    action: str = Field(index=True)
    entity_name: str = Field(index=True)
    entity_id: uuid.UUID | None = Field(default=None, index=True)
    old_values: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    new_values: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
    )


__all__ = ["AuditLog"]
