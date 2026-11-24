"""On-demand chore instances created from a template outside its daily schedule (#959)."""

import logging
import uuid
from datetime import date

from backend_shared.household import HouseholdContext, MemberDirectory, find_member
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.exceptions import (
    AssigneeNotAssignableError,
    AssigneeNotMemberError,
    AssignmentForbiddenError,
    ChoreTemplateNotFoundError,
    IdempotencyKeyConflictError,
)
from src.features.chore_management.models import ChoreInstance
from src.features.chore_management.services.instance_service import InstanceService
from src.features.chore_management.services.template_service import TemplateService

logger = logging.getLogger(__name__)


class OneOffInstanceService:
    """Creates one chore instance now, for example when a Home Assistant event fires."""

    @staticmethod
    async def check_assignee(
        directory: MemberDirectory, context: HouseholdContext, assignee_id: uuid.UUID | None
    ) -> None:
        """Validate the requested assignee against the household's member list.

        A member may assign the new chore to themself; assigning someone else needs OWNER/ADMIN,
        as for ``POST /instances/{id}/assign``. A service principal acts on behalf of the admin who
        enabled its plugin, so it may assign any member who can act on chores. Raises
        :class:`~backend_shared.household.MembershipServiceError` when members cannot be listed.
        """
        if assignee_id is None:
            return
        if not context.is_service:
            if not InstanceService.can_assign(assignee_id, context.user_id, context.role):
                raise AssignmentForbiddenError("Only household owners or admins may assign a chore to someone else.")
            if assignee_id == context.user_id:
                return
        member = await find_member(directory, context.household_id, assignee_id)
        if member is None:
            raise AssigneeNotMemberError("The assignee is not a member of this household.")
        if not InstanceService.can_hold_assignment(member.role):
            raise AssigneeNotAssignableError("A guest has read-only access and cannot be assigned chores.")

    @staticmethod
    async def find_by_key(session: AsyncSession, home_id: uuid.UUID, key: str) -> ChoreInstance | None:
        """Return the household's instance created with Idempotency-Key ``key``, if any."""
        stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.idempotency_key == key)
        return (await session.exec(stmt)).first()

    @staticmethod
    def _replay(existing: ChoreInstance, template_id: uuid.UUID) -> ChoreInstance:
        if existing.template_id != template_id:
            raise IdempotencyKeyConflictError("The Idempotency-Key was already used for another chore template.")
        return existing

    @staticmethod
    async def create_instance(
        session: AsyncSession,
        home_id: uuid.UUID,
        template_id: uuid.UUID,
        due_date: date | None = None,
        assignee_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[ChoreInstance, bool]:
        """Create a pending one-off instance of the household's template.

        Returns the instance and whether it was created. With an ``idempotency_key`` that the
        household already used, the stored instance is returned unchanged (``False``); a key reused
        for another template raises :class:`IdempotencyKeyConflictError`. A template of another
        household raises :class:`ChoreTemplateNotFoundError`.
        """
        if idempotency_key is not None:
            existing = await OneOffInstanceService.find_by_key(session, home_id, idempotency_key)
            if existing is not None:
                return OneOffInstanceService._replay(existing, template_id), False

        if await TemplateService.get_chore_template(session, template_id, home_id) is None:
            raise ChoreTemplateNotFoundError("Chore template not found.")

        instance = ChoreInstance(
            template_id=template_id,
            home_id=home_id,
            due_date=due_date or date.today(),
            assigned_to=assignee_id,
            status="pending",
            points_awarded=0,
            is_one_off=True,
            idempotency_key=idempotency_key,
        )
        session.add(instance)
        try:
            await session.commit()
        except IntegrityError:
            # A concurrent delivery with the same key won the insert: answer with its instance.
            await session.rollback()
            if idempotency_key is None:
                raise
            existing = await OneOffInstanceService.find_by_key(session, home_id, idempotency_key)
            if existing is None:
                raise
            return OneOffInstanceService._replay(existing, template_id), False
        await session.refresh(instance)
        logger.info("Created one-off chore instance %s from template %s", instance.id, template_id)
        return instance, True
