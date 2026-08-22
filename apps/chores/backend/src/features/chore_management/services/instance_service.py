import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.exceptions import (
    ChoreAlreadyCompletedError,
    ChoreInstanceNotFoundError,
    ChoreNotAssignableError,
    ChoreTemplateNotFoundError,
)
from src.features.chore_management.models import (
    ChoreCompletionHistory,
    ChoreInstance,
    ChoreTemplate,
    HouseholdStreak,
)
from src.features.chore_management.schemas import ChoreAssignRequest
from src.features.chore_management.services.streak_service import StreakService
from src.features.chore_management.services.template_service import TemplateService

logger = logging.getLogger(__name__)


class InstanceService:
    """Service class encapsulating chore instances, reset, completion, and timeline history."""

    @staticmethod
    async def ensure_household_reset(session: AsyncSession, home_id: uuid.UUID, target_date: date) -> None:
        """Retroactively verify and generate chore instances up to the target date.

        If target_date instances don't exist yet, it archives yesterday's
        uncompleted chores as missed, recalculates the streak, and generates today's tasks.
        """
        # Check if we already generated instances for today
        stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == target_date)
        res = await session.exec(stmt)
        if res.first():
            return

        streak = await StreakService.ensure_household_streak(session, home_id)

        # Yesterday's chores evaluation
        yesterday = target_date - timedelta(days=1)
        y_stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == yesterday)
        y_res = await session.exec(y_stmt)
        yesterday_instances = y_res.all()

        if yesterday_instances:
            uncompleted = [inst for inst in yesterday_instances if inst.status != "completed"]
            if uncompleted:
                for inst in uncompleted:
                    inst.status = "missed"
                    session.add(inst)
                streak.current_streak = 0
            else:
                if streak.last_completed_date != yesterday:
                    streak.current_streak += 1
                    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
                    streak.last_completed_date = yesterday
            session.add(streak)

        # Generate new chore instances for target_date
        t_stmt = select(ChoreTemplate).where(ChoreTemplate.home_id == home_id)
        t_res = await session.exec(t_stmt)
        templates = t_res.all()

        for t in templates:
            inst = ChoreInstance(
                template_id=t.id,
                home_id=home_id,
                due_date=target_date,
                status="pending",
                points_awarded=0,
            )
            session.add(inst)

        try:
            await session.commit()
            logger.info(f"Generated {len(templates)} chore instances for household {home_id} on {target_date}")
        except Exception as e:
            await session.rollback()
            logger.error(f"Failed to generate chores for household {home_id} on {target_date}: {e}")

    @staticmethod
    async def get_today_chores(
        session: AsyncSession,
        home_id: uuid.UUID,
        due_date: date | None = None,
    ) -> Sequence[ChoreInstance]:
        """Fetch all chore instances for a given date, triggering self-healing generation if necessary."""
        if not due_date:
            due_date = date.today()

        # Run self-healing reset/generator before querying
        await InstanceService.ensure_household_reset(session, home_id, due_date)

        stmt = select(ChoreInstance).where(
            ChoreInstance.home_id == home_id,
            ChoreInstance.due_date == due_date,
        )
        res = await session.exec(stmt)
        return res.all()

    @staticmethod
    async def assign_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        payload: ChoreAssignRequest,
        home_id: uuid.UUID,
    ) -> ChoreInstance:
        """Assign a chore instance to a user in the household."""
        stmt = select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.home_id == home_id,
        )
        res = await session.exec(stmt)
        instance = res.first()
        if not instance:
            raise ChoreInstanceNotFoundError(f"Chore instance with ID {instance_id} not found.")

        if instance.status == "completed":
            raise ChoreAlreadyCompletedError("Cannot assign an already completed chore.")
        if instance.status == "missed":
            raise ChoreNotAssignableError("Cannot assign a missed chore.")

        instance.assigned_to = payload.assigned_to
        instance.updated_at = datetime.now(UTC)
        session.add(instance)
        await session.commit()
        await session.refresh(instance)
        return instance

    @staticmethod
    async def complete_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        completed_by: uuid.UUID,
        home_id: uuid.UUID,
        completed_by_name: str | None = None,
    ) -> ChoreInstance:
        """Mark a chore instance as completed, awarding points, logging timeline audit record and evaluating streak extensions."""
        stmt = select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.home_id == home_id,
        )
        res = await session.exec(stmt)
        instance = res.first()
        if not instance:
            raise ChoreInstanceNotFoundError(f"Chore instance with ID {instance_id} not found.")

        if instance.status == "completed":
            raise ChoreAlreadyCompletedError("Chore instance is already completed.")

        # Get template to fetch point details
        t_stmt = select(ChoreTemplate).where(ChoreTemplate.id == instance.template_id)
        t_res = await session.exec(t_stmt)
        template = t_res.first()
        points = template.points if template else 10

        completed_timestamp = datetime.now(UTC)
        instance.status = "completed"
        instance.completed_by = completed_by
        instance.completed_at = completed_timestamp
        instance.points_awarded = points
        instance.updated_at = completed_timestamp
        session.add(instance)

        # Write timeline audit entry to ChoreCompletionHistory
        history_entry = ChoreCompletionHistory(
            template_id=instance.template_id,
            instance_id=instance.id,
            home_id=home_id,
            completed_by=completed_by,
            completed_by_name=completed_by_name,
            completed_at=completed_timestamp,
            points_awarded=points,
        )
        session.add(history_entry)

        # Check if this completes all chores of the day to immediately increment the streak
        today_date = instance.due_date
        all_stmt = select(ChoreInstance).where(
            ChoreInstance.home_id == home_id,
            ChoreInstance.due_date == today_date,
        )
        all_res = await session.exec(all_stmt)
        today_instances = all_res.all()

        # If all instances (excluding this one if session not committed yet) are completed
        others_completed = all(inst.status == "completed" or inst.id == instance.id for inst in today_instances)
        if others_completed:
            streak = await StreakService.ensure_household_streak(session, home_id)
            if streak.last_completed_date != today_date:
                streak.current_streak += 1
                streak.longest_streak = max(streak.longest_streak, streak.current_streak)
                streak.last_completed_date = today_date
                session.add(streak)

        await session.commit()
        await session.refresh(instance)
        return instance

    @staticmethod
    async def get_task_timeline(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreCompletionHistory]:
        """Retrieve the historical completion timeline for a specific task template."""
        template = await TemplateService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        stmt = (
            select(ChoreCompletionHistory)
            .where(
                ChoreCompletionHistory.template_id == template_id,
                ChoreCompletionHistory.home_id == home_id,
            )
            .order_by(col(ChoreCompletionHistory.completed_at).desc())
            .offset(offset)
            .limit(limit)
        )
        res = await session.exec(stmt)
        return res.all()

    @staticmethod
    async def get_integrations_summary(
        session: AsyncSession,
        home_id: uuid.UUID,
    ) -> dict:
        """Retrieve streak metrics and today's completion rates for analytics dashboards."""
        today_date = date.today()
        # Ensure chores are generated
        await InstanceService.ensure_household_reset(session, home_id, today_date)

        streak = await StreakService.ensure_household_streak(session, home_id)

        stmt = select(ChoreInstance).where(
            ChoreInstance.home_id == home_id,
            ChoreInstance.due_date == today_date,
        )
        res = await session.exec(stmt)
        today_chores = res.all()

        total = len(today_chores)
        completed = sum(1 for inst in today_chores if inst.status == "completed")
        pending = total - completed
        rate = (completed / total * 100.0) if total > 0 else 100.0

        return {
            "home_id": home_id,
            "current_streak": streak.current_streak,
            "longest_streak": streak.longest_streak,
            "today_completed_count": completed,
            "today_pending_count": pending,
            "today_total_count": total,
            "completion_rate": round(rate, 2),
            "today_chores": today_chores,
        }

    @staticmethod
    async def run_nightly_reset_for_all(session: AsyncSession, target_date: date) -> None:
        """Run daily evaluations across all active households containing templates or streak tracking."""
        # Find all unique households
        t_stmt = select(ChoreTemplate.home_id).distinct()
        t_res = await session.exec(t_stmt)
        home_ids = set(t_res.all())

        s_stmt = select(HouseholdStreak.home_id).distinct()
        s_res = await session.exec(s_stmt)
        home_ids.update(s_res.all())

        logger.info(f"Starting nightly chores reset for {len(home_ids)} households on {target_date}")
        for home_id in home_ids:
            await InstanceService.ensure_household_reset(session, home_id, target_date)
