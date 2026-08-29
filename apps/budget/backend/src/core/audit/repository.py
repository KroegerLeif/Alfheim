"""Repository layer for audit log persistence and retrieval."""

import uuid
from collections.abc import Sequence

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.audit.models import AuditLog


class AuditRepository:
    """Repository handling database access for AuditLog entities."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with an active database session."""
        self.session = session

    async def create(self, audit_log: AuditLog) -> AuditLog:
        """Persist a new audit log record."""
        self.session.add(audit_log)
        await self.session.flush()
        return audit_log

    async def get_by_household(self, household_id: uuid.UUID, limit: int = 100, offset: int = 0) -> Sequence[AuditLog]:
        """Retrieve audit log records for a given household ordered by timestamp descending."""
        statement = (
            select(AuditLog)
            .where(AuditLog.household_id == household_id)
            .order_by(col(AuditLog.timestamp).desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def get_by_entity(self, entity_name: str, entity_id: uuid.UUID, limit: int = 100) -> Sequence[AuditLog]:
        """Retrieve audit log records for a specific entity ordered by timestamp descending."""
        statement = (
            select(AuditLog)
            .where(AuditLog.entity_name == entity_name, AuditLog.entity_id == entity_id)
            .order_by(col(AuditLog.timestamp).desc())
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()


__all__ = ["AuditRepository"]
