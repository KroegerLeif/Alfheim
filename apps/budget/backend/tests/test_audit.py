"""Unit and integration tests for audit log generation and event hooks."""

import uuid

import pytest
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.audit.hooks import clear_audit_context, set_audit_context
from src.core.audit.models import AuditLog
from src.core.audit.repository import AuditRepository


class DummySampleEntity(SQLModel, table=True):
    """Sample SQLModel entity to test audit log hooks."""

    __tablename__ = "dummy_sample_entities"

    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True)
    household_id: uuid.UUID
    name: str
    amount: float


@pytest.fixture(autouse=True)
def _cleanup_context():
    """Ensure audit context is cleared before and after each test."""
    clear_audit_context()
    yield
    clear_audit_context()


@pytest.mark.asyncio
async def test_audit_log_on_create(db_session: AsyncSession):
    """Verify that creating an entity automatically inserts an AuditLog entry."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    set_audit_context(user_id=user_id, household_id=household_id)

    entity = DummySampleEntity(
        household_id=household_id,
        name="Emergency Reserve",
        amount=1500.0,
    )
    db_session.add(entity)
    await db_session.commit()

    repo = AuditRepository(db_session)
    logs = await repo.get_by_household(household_id)

    assert entity.id is not None
    assert len(logs) == 1
    log = logs[0]
    assert log.action == "CREATE"
    assert log.entity_name == "DummySampleEntity"
    assert log.entity_id == entity.id
    assert log.user_id == user_id
    assert log.household_id == household_id
    assert log.old_values is None
    assert log.new_values is not None
    assert log.new_values["name"] == "Emergency Reserve"
    assert log.new_values["amount"] == 1500.0


@pytest.mark.asyncio
async def test_audit_log_on_update(db_session: AsyncSession):
    """Verify that updating an entity creates an AuditLog with old and new values."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    set_audit_context(user_id=user_id, household_id=household_id)

    entity = DummySampleEntity(
        household_id=household_id,
        name="Old Name",
        amount=100.0,
    )
    db_session.add(entity)
    await db_session.commit()

    # Update entity values
    entity.name = "Updated Name"
    entity.amount = 250.0
    await db_session.commit()

    assert entity.id is not None
    repo = AuditRepository(db_session)
    logs = await repo.get_by_entity("DummySampleEntity", entity.id)

    assert len(logs) == 2
    update_log = logs[0]  # Ordered by timestamp desc
    assert update_log.action == "UPDATE"
    assert update_log.old_values is not None
    assert update_log.new_values is not None
    assert update_log.old_values["name"] == "Old Name"
    assert update_log.old_values["amount"] == 100.0
    assert update_log.new_values["name"] == "Updated Name"
    assert update_log.new_values["amount"] == 250.0


@pytest.mark.asyncio
async def test_audit_log_on_delete(db_session: AsyncSession):
    """Verify that deleting an entity creates an AuditLog entry with old values."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    set_audit_context(user_id=user_id, household_id=household_id)

    entity = DummySampleEntity(
        household_id=household_id,
        name="To Be Deleted",
        amount=50.0,
    )
    db_session.add(entity)
    await db_session.commit()

    await db_session.delete(entity)
    await db_session.commit()

    statement = select(AuditLog).where(
        AuditLog.entity_name == "DummySampleEntity",
        AuditLog.entity_id == entity.id,
        AuditLog.action == "DELETE",
    )
    result = await db_session.exec(statement)
    delete_log = result.first()

    assert delete_log is not None
    assert delete_log.action == "DELETE"
    assert delete_log.old_values is not None
    assert delete_log.old_values["name"] == "To Be Deleted"
    assert delete_log.new_values is None
