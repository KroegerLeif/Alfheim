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
        return await StreakService.ensure_household_streak(session, home_id)

    @staticmethod
    async def ensure_household_reset(session: AsyncSession, home_id: uuid.UUID, target_date: date) -> None:
        return await InstanceService.ensure_household_reset(session, home_id, target_date)

    @staticmethod
    async def create_chore_template(
        session: AsyncSession,
        payload: ChoreTemplateCreate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        return await TemplateService.create_chore_template(session, payload, home_id)

    @staticmethod
    async def get_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ChoreTemplate | None:
        return await TemplateService.get_chore_template(session, template_id, home_id)

    @staticmethod
    async def list_chore_templates(
        session: AsyncSession,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreTemplate]:
        return await TemplateService.list_chore_templates(session, home_id, limit, offset)

    @staticmethod
    async def update_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        payload: ChoreTemplateUpdate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        return await TemplateService.update_chore_template(session, template_id, payload, home_id)

    @staticmethod
    async def delete_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        return await TemplateService.delete_chore_template(session, template_id, home_id)

    @staticmethod
    async def get_today_chores(
        session: AsyncSession,
        home_id: uuid.UUID,
        due_date: date | None = None,
    ) -> Sequence[ChoreInstance]:
        return await InstanceService.get_today_chores(session, home_id, due_date)

    @staticmethod
    async def assign_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        payload: ChoreAssignRequest,
        home_id: uuid.UUID,
    ) -> ChoreInstance:
        return await InstanceService.assign_chore_instance(session, instance_id, payload, home_id)

    @staticmethod
    async def complete_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        completed_by: uuid.UUID,
        home_id: uuid.UUID,
        completed_by_name: str | None = None,
    ) -> ChoreInstance:
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
        return await InstanceService.get_task_timeline(session, template_id, home_id, limit, offset)

    @staticmethod
    async def get_integrations_summary(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> dict:
        return await InstanceService.get_integrations_summary(session, home_id)

    @staticmethod
    async def run_nightly_reset_for_all(session: AsyncSession, target_date: date) -> None:
        return await InstanceService.run_nightly_reset_for_all(session, target_date)
