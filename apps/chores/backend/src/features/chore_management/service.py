import uuid
import logging
from datetime import date, datetime, timezone, timedelta
from typing import Optional, Sequence
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, or_
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.chore_management.models import (
    ChoreTemplate,
    ChoreInstance,
    HouseholdStreak,
    ChoreCompletionHistory,
)
from src.features.chore_management.schemas import ChoreTemplateCreate, ChoreTemplateUpdate, ChoreAssignRequest
from src.features.chore_management.exceptions import (
    ChoreTemplateNotFoundError,
    ChoreInstanceNotFoundError,
    ChoreAlreadyCompletedError,
    ChoreNotAssignableError,
    DuplicateChoreTemplateError,
    HouseholdStreakNotFoundError,
)

logger = logging.getLogger(__name__)


class ChoreService:
    """Service class encapsulating async database operations for Chores management."""

    @staticmethod
    async def ensure_household_streak(session: AsyncSession, home_id: uuid.UUID) -> HouseholdStreak:
        """Get or create the HouseholdStreak record for a household."""
        stmt = select(HouseholdStreak).where(HouseholdStreak.home_id == home_id)
        res = await session.exec(stmt)
        streak = res.first()
        if not streak:
            streak = HouseholdStreak(
                home_id=home_id,
                current_streak=0,
                longest_streak=0,
                last_completed_date=None,
            )
            session.add(streak)
            try:
                await session.commit()
                await session.refresh(streak)
            except IntegrityError:
                await session.rollback()
                # If race occurred, select it again
                res = await session.exec(stmt)
                streak = res.first()
        return streak

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

        streak = await ChoreService.ensure_household_streak(session, home_id)

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
    async def create_chore_template(
        session: AsyncSession,
        payload: ChoreTemplateCreate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Create a new chore template blueprint in the household context."""
        clash_stmt = select(ChoreTemplate).where(
            ChoreTemplate.home_id == home_id,
            ChoreTemplate.name == payload.name,
        )
        clash_res = await session.exec(clash_stmt)
        if clash_res.first():
            raise DuplicateChoreTemplateError(
                f"Chore template with name '{payload.name}' already exists in this household."
            )

        template = ChoreTemplate(
            home_id=home_id,
            name=payload.name,
            description=payload.description,
            points=payload.points,
            is_non_cumulative=payload.is_non_cumulative,
        )
        session.add(template)
        try:
            await session.commit()
            await session.refresh(template)
        except IntegrityError as e:
            await session.rollback()
            raise DuplicateChoreTemplateError(f"Chore template name conflict: {e}") from e
        return template

    @staticmethod
    async def get_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> Optional[ChoreTemplate]:
        """Retrieve a specific chore template if it belongs to the active household."""
        stmt = select(ChoreTemplate).where(
            ChoreTemplate.id == template_id,
            ChoreTemplate.home_id == home_id,
        )
        res = await session.exec(stmt)
        return res.first()

    @staticmethod
    async def list_chore_templates(
        session: AsyncSession,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreTemplate]:
        """List all chore templates registered in the household."""
        stmt = select(ChoreTemplate).where(ChoreTemplate.home_id == home_id).offset(offset).limit(limit)
        res = await session.exec(stmt)
        return res.all()

    @staticmethod
    async def update_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        payload: ChoreTemplateUpdate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Partially update a chore template."""
        template = await ChoreService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        update_data = payload.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != template.name:
            clash_stmt = select(ChoreTemplate).where(
                ChoreTemplate.home_id == home_id,
                ChoreTemplate.name == update_data["name"],
                ChoreTemplate.id != template_id,
            )
            clash_res = await session.exec(clash_stmt)
            if clash_res.first():
                raise DuplicateChoreTemplateError(
                    f"Chore template with name '{update_data['name']}' already exists."
                )

        for key, val in update_data.items():
            setattr(template, key, val)

        session.add(template)
        try:
            await session.commit()
            await session.refresh(template)
        except IntegrityError as e:
            await session.rollback()
            raise DuplicateChoreTemplateError(f"Chore template name conflict: {e}") from e
        return template

    @staticmethod
    async def delete_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a chore template."""
        template = await ChoreService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        await session.delete(template)
        await session.commit()
        return True

    @staticmethod
    async def get_today_chores(
        session: AsyncSession,
        home_id: uuid.UUID,
        due_date: Optional[date] = None,
    ) -> Sequence[ChoreInstance]:
        """Fetch all chore instances for a given date, triggering self-healing generation if necessary."""
        if not due_date:
            due_date = date.today()

        # Run self-healing reset/generator before querying
        await ChoreService.ensure_household_reset(session, home_id, due_date)

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
        instance.updated_at = datetime.now(timezone.utc)
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
        completed_by_name: Optional[str] = None,
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

        completed_timestamp = datetime.now(timezone.utc)
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
            streak = await ChoreService.ensure_household_streak(session, home_id)
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
        template = await ChoreService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        stmt = (
            select(ChoreCompletionHistory)
            .where(
                ChoreCompletionHistory.template_id == template_id,
                ChoreCompletionHistory.home_id == home_id,
            )
            .order_by(ChoreCompletionHistory.completed_at.desc())
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
        await ChoreService.ensure_household_reset(session, home_id, today_date)

        streak = await ChoreService.ensure_household_streak(session, home_id)

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
            await ChoreService.ensure_household_reset(session, home_id, target_date)
