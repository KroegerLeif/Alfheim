"""OneOffInstanceService edge cases: concurrent deliveries and the MCP tool (#959)."""

import inspect
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from backend_shared.household import MembershipServiceError, derive_user_id
from backend_shared.household.testing import mcp_household_context, mcp_membership
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management import mcp_one_off_tools
from src.features.chore_management.exceptions import IdempotencyKeyConflictError
from src.features.chore_management.mcp_one_off_tools import create_chore_instance
from src.features.chore_management.models import ChoreTemplate
from src.features.chore_management.services import one_off_service
from src.features.chore_management.services.one_off_service import OneOffInstanceService

HOUSEHOLD = uuid.UUID("00000000-0000-0000-0000-0000000000c1")
SUB = "312345678901234567"


def _duplicate() -> IntegrityError:
    return IntegrityError("INSERT INTO chore_instances", {}, Exception("duplicate key"))


async def _template_id(session: AsyncSession, home_id: uuid.UUID = HOUSEHOLD) -> uuid.UUID:
    template = ChoreTemplate(name=f"T-{uuid.uuid4()}", home_id=home_id, points=3)
    session.add(template)
    await session.commit()
    return template.id


@pytest.fixture
def lost_race(db_session: AsyncSession):
    """Make every insert lose against a concurrent delivery: the commit hits the unique key."""
    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=_duplicate())),
        patch.object(db_session, "rollback", AsyncMock()),
        patch.object(one_off_service.TemplateService, "get_chore_template", AsyncMock(return_value=object())),
    ):
        yield


@pytest.mark.asyncio
async def test_lost_insert_race_returns_the_winner(db_session: AsyncSession, lost_race):
    template_id = uuid.uuid4()
    stored = SimpleNamespace(id=uuid.uuid4(), template_id=template_id)
    with patch.object(OneOffInstanceService, "find_by_key", AsyncMock(side_effect=[None, stored])):
        again, created = await OneOffInstanceService.create_instance(
            db_session, HOUSEHOLD, template_id, idempotency_key="k"
        )
    assert not created
    assert again is stored

    with (
        patch.object(OneOffInstanceService, "find_by_key", AsyncMock(side_effect=[None, stored])),
        pytest.raises(IdempotencyKeyConflictError),
    ):
        await OneOffInstanceService.create_instance(db_session, HOUSEHOLD, uuid.uuid4(), idempotency_key="k")


@pytest.mark.asyncio
async def test_integrity_errors_without_a_stored_key_are_raised(db_session: AsyncSession, lost_race):
    with pytest.raises(IntegrityError):
        await OneOffInstanceService.create_instance(db_session, HOUSEHOLD, uuid.uuid4())
    with (
        patch.object(OneOffInstanceService, "find_by_key", AsyncMock(return_value=None)),
        pytest.raises(IntegrityError),
    ):
        await OneOffInstanceService.create_instance(db_session, HOUSEHOLD, uuid.uuid4(), idempotency_key="gone")


@pytest.fixture
def mcp_session(db_session: AsyncSession):
    class SessionContext:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return None

    with patch.object(mcp_one_off_tools, "async_session_factory", side_effect=SessionContext):
        yield


def test_tool_takes_no_household_or_user_argument():
    assert not {"household_id", "home_id", "user_id"} & set(inspect.signature(create_chore_instance).parameters)


@pytest.mark.asyncio
async def test_mcp_tool(db_session: AsyncSession, mcp_session):
    template = str(await _template_id(db_session))
    foreign = str(await _template_id(db_session, uuid.uuid4()))
    with pytest.raises(RuntimeError, match="Household context not found"):
        await create_chore_instance(template_id=template)
    with mcp_household_context(household_id=HOUSEHOLD, sub=SUB, role="MEMBER"):
        assert "due 2030-01-02" in await create_chore_instance(template_id=template, due_date="2030-01-02")
        assert "Invalid" in await create_chore_instance(template_id="nope")
        assert "not found" in await create_chore_instance(template_id=foreign)
        assert "owners or admins" in await create_chore_instance(template_id=template, assignee_user_id="other")
        assert (await create_chore_instance(template_id=template, assignee_user_id=SUB)).startswith("Success")
    with mcp_household_context(household_id=HOUSEHOLD, sub=SUB, role="OWNER"):
        with mcp_membership({(HOUSEHOLD, "m"): "MEMBER"}):
            member = str(derive_user_id("m"))
            assert (await create_chore_instance(template_id=template, assignee_user_id=member)).startswith("Success")
        with mcp_membership({}) as lookup:
            down = AsyncMock(side_effect=MembershipServiceError("down"))
            with patch.object(type(lookup), "list_members", down):
                assert "cannot be checked" in await create_chore_instance(template_id=template, assignee_user_id="x")
