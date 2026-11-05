"""Facade over the template, instance and streak services so callers keep one import."""

import logging
import uuid
from collections.abc import Sequence
from datetime import date

from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.models import (
    ChoreCompletionHistory,
    ChoreInstance,
    ChoreTemplate,
    HouseholdStreak,
)
from src.features.chore_management.schemas import (
    ChoreAssignRequest,
    ChoreTemplateCreate,
    ChoreTemplateUpdate,
)
from src.features.chore_management.services.instance_service import InstanceService
from src.features.chore_management.services.streak_service import StreakService
from src.features.chore_management.services.template_service import TemplateService

logger = logging.getLogger(__name__)


class ChoreService:
    """Service class encapsulating async database operations for Chores management.

    Delegates responsibilities to StreakService, TemplateService, and InstanceService.
    """

    @staticmethod
    async def ensure_household_streak(session: AsyncSession, home_id: uuid.UUID) -> HouseholdStreak:
        """Get or create the household streak record."""
        return await StreakService.ensure_household_streak(session, home_id)

    @staticmethod
    async def ensure_household_reset(session: AsyncSession, home_id: uuid.UUID, target_date: date) -> None:
        """Generate missing chore instances up to ``target_date`` for the household."""
        return await InstanceService.ensure_household_reset(session, home_id, target_date)

    @staticmethod
    async def create_chore_template(
        session: AsyncSession,
        payload: ChoreTemplateCreate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Create a template; raises ``DuplicateChoreTemplateError`` if the name exists in the household."""
        return await TemplateService.create_chore_template(session, payload, home_id)

    @staticmethod
    async def get_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ChoreTemplate | None:
        """Return the household's template or ``None`` if it does not exist."""
        return await TemplateService.get_chore_template(session, template_id, home_id)

    @staticmethod
    async def list_chore_templates(
        session: AsyncSession,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreTemplate]:
        """List the household's templates with pagination."""
        return await TemplateService.list_chore_templates(session, home_id, limit, offset)

    @staticmethod
    async def update_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        payload: ChoreTemplateUpdate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Update a template of the household; raises if it is missing or the new name clashes."""
        return await TemplateService.update_chore_template(session, template_id, payload, home_id)

    @staticmethod
    async def delete_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a template of the household; returns whether one was removed."""
        return await TemplateService.delete_chore_template(session, template_id, home_id)

    @staticmethod
    async def get_today_chores(
        session: AsyncSession,
        home_id: uuid.UUID,
        due_date: date | None = None,
    ) -> Sequence[ChoreInstance]:
        """Return the household's chore instances for a date (default today), generating missing ones first."""
        return await InstanceService.get_today_chores(session, home_id, due_date)

    @staticmethod
    async def assign_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        payload: ChoreAssignRequest,
        home_id: uuid.UUID,
    ) -> ChoreInstance:
        """Assign or release a chore instance; completed or missed chores cannot be assigned."""
        return await InstanceService.assign_chore_instance(session, instance_id, payload, home_id)

    @staticmethod
    async def claim_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> ChoreInstance:
        """Assign a chore instance to the calling user."""
        return await InstanceService.claim_chore_instance(session, instance_id, home_id, user_id)

    @staticmethod
    async def complete_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        completed_by: uuid.UUID,
        home_id: uuid.UUID,
        completed_by_name: str | None = None,
    ) -> ChoreInstance:
        """Mark an instance completed, award points and update the household streak."""
        return await InstanceService.complete_chore_instance(
            session, instance_id, completed_by, home_id, completed_by_name
        )

    @staticmethod
    async def get_task_timeline(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreCompletionHistory]:
        """Return the completion history of a template within the household, newest first."""
        return await InstanceService.get_task_timeline(session, template_id, home_id, limit, offset)

    @staticmethod
    async def get_integrations_summary(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> dict:
        """Build today's completion and streak summary for the household."""
        return await InstanceService.get_integrations_summary(session, home_id)

    @staticmethod
    async def run_nightly_reset_for_all(session: AsyncSession, target_date: date) -> None:
        """Run the daily reset for every household with templates or a streak."""
        return await InstanceService.run_nightly_reset_for_all(session, target_date)
