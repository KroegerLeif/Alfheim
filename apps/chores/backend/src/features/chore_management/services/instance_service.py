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


ELEVATED_ASSIGN_ROLES = frozenset({"OWNER", "ADMIN"})


class InstanceService:
    """Service class encapsulating chore instances, reset, completion, and timeline history."""

    @staticmethod
    def can_assign(target: uuid.UUID | None, caller_user_id: uuid.UUID, caller_role: str) -> bool:
        """Whether ``caller`` may set a chore instance's ``assigned_to`` to ``target``.

        Anyone may claim a chore for themself or release it (``target`` is
        ``None`` or their own id). Assigning it to a *different* household
        member is an elevated, explicit action restricted to OWNER/ADMIN.
        """
        return target is None or target == caller_user_id or caller_role in ELEVATED_ASSIGN_ROLES

    @staticmethod
    async def ensure_household_reset(session: AsyncSession, home_id: uuid.UUID, target_date: date) -> None:
        """Retroactively verify and generate chore instances up to the target date.

        The first time this runs for ``target_date`` it evaluates yesterday's
        instances (archiving non-cumulative ones as missed, rolling cumulative
        ones forward so they keep stacking, and recalculating the streak), then
        generates a ``target_date`` instance for every template that doesn't
        already have one. That per-template diff (rather than a single
        household-wide existence check) also makes the function idempotent and
        safe to call again later in the day: a template created after the first
        call still gets its instance, and re-running never creates duplicates.

        Reset semantics for ``ChoreTemplate.is_non_cumulative``:
        - ``True`` (default, "non-cumulative"): an unfinished instance expires
          at midnight -- it is marked ``"missed"`` and a fresh ``"pending"``
          instance is generated for ``target_date``. Missing one of these
          resets the household streak to 0.
        - ``False`` ("cumulative"): an unfinished instance is *not* marked
          missed. It is rolled forward (its ``due_date`` becomes
          ``target_date``) so the same outstanding chore keeps stacking up
          until someone completes it, and it never resets the streak.
        """
        templates = (await session.exec(select(ChoreTemplate).where(ChoreTemplate.home_id == home_id))).all()
        template_by_id = {t.id: t for t in templates}

        # Instances that already exist for target_date (from a prior call today, or rolled forward below).
        existing_stmt = select(ChoreInstance).where(
            ChoreInstance.home_id == home_id, ChoreInstance.due_date == target_date
        )
        existing_instances = (await session.exec(existing_stmt)).all()
        covered_template_ids = {inst.template_id for inst in existing_instances}
        already_processed_today = bool(existing_instances)

        if not already_processed_today:
            streak = await StreakService.ensure_household_streak(session, home_id)

            # Yesterday's chores evaluation
            yesterday = target_date - timedelta(days=1)
            y_stmt = select(ChoreInstance).where(ChoreInstance.home_id == home_id, ChoreInstance.due_date == yesterday)
            y_res = await session.exec(y_stmt)
            yesterday_instances = y_res.all()

            if yesterday_instances:
                uncompleted = [inst for inst in yesterday_instances if inst.status != "completed"]
                non_cumulative_missed = []
                for inst in uncompleted:
                    template = template_by_id.get(inst.template_id)
                    # Orphaned instances (template deleted) default to non-cumulative (expire).
                    is_non_cumulative = template.is_non_cumulative if template else True
                    if is_non_cumulative:
                        inst.status = "missed"
                        session.add(inst)
                        non_cumulative_missed.append(inst)
                    else:
                        # Cumulative: keep it pending and roll it forward so it stacks up.
                        inst.due_date = target_date
                        session.add(inst)
                        covered_template_ids.add(inst.template_id)

                if non_cumulative_missed:
                    streak.current_streak = 0
                elif streak.last_completed_date != yesterday:
                    streak.current_streak += 1
                    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
                    streak.last_completed_date = yesterday
                session.add(streak)

        # Generate instances for every template that doesn't have one for target_date yet
        # (new templates created after today's reset already ran, in addition to the normal
        # daily set).
        missing_templates = [t for t in templates if t.id not in covered_template_ids]
        for t in missing_templates:
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
            logger.info(f"Generated {len(missing_templates)} chore instances for household {home_id} on {target_date}")
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
    async def claim_chore_instance(
        session: AsyncSession,
        instance_id: uuid.UUID,
        home_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> ChoreInstance:
        """Claim an unassigned chore instance for ``user_id``, or release it if they already hold it.

        This backs the dashboard's self-service "Claim" button: the assignee is
        always the authenticated caller, taken from ``user_id`` and never from
        client-supplied input. Claiming a chore already held by a different
        member is rejected -- reassigning it to someone else is a distinct,
        role-checked action (see :meth:`assign_chore_instance`).
        """
        stmt = select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.home_id == home_id,
        )
        res = await session.exec(stmt)
        instance = res.first()
        if not instance:
            raise ChoreInstanceNotFoundError(f"Chore instance with ID {instance_id} not found.")

        if instance.assigned_to is not None and instance.assigned_to != user_id:
            raise ChoreNotAssignableError("This chore is already claimed by another household member.")

        target = None if instance.assigned_to == user_id else user_id
        return await InstanceService.assign_chore_instance(
            session, instance_id, ChoreAssignRequest(assigned_to=target), home_id
        )

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
