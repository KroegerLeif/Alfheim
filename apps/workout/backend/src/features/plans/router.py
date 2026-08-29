import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.core.dependencies import UserHomeContext, get_current_user_and_home
from src.features.plans import service
from src.features.plans.schemas import (
    PlanCreate,
    PlanDayCreate,
    PlanDayRead,
    PlanExerciseCreate,
    PlanExerciseRead,
    PlanRead,
    PlanSetCreate,
    PlanSetRead,
    PlanSetUpdate,
    PlanUpdate,
    ResolvedDayRead,
    ResolvedExerciseRead,
    ResolvedSetRead,
)

router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


@router.post("", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new multi-day workout plan, optionally with its full nested structure."""
    return await service.create_plan(session, payload, context.home_id, context.user_id)


@router.get("", response_model=list[PlanRead])
async def list_plans(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List plans visible to the caller: their own plans plus any shared within their household."""
    return await service.list_plans(session, context.home_id, context.user_id, limit, offset)


@router.get("/{plan_id}", response_model=PlanRead)
async def get_plan(
    plan_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve a single plan by ID."""
    plan = await service.get_plan(session, plan_id, context.home_id, context.user_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    return plan


@router.patch("/{plan_id}", response_model=PlanRead)
async def update_plan(
    plan_id: uuid.UUID,
    payload: PlanUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Update a plan's metadata (name/description/is_shared/is_active). Only the owner may edit."""
    plan = await service.update_plan(session, plan_id, context.home_id, context.user_id, payload)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a plan. Only the owner may delete. Session logs cloned from this plan are unaffected."""
    deleted = await service.delete_plan(session, plan_id, context.home_id, context.user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")


@router.post("/{plan_id}/days", response_model=PlanDayRead, status_code=status.HTTP_201_CREATED)
async def add_day(
    plan_id: uuid.UUID,
    payload: PlanDayCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Append a new day (with optional nested exercises/sets) to the end of a plan's split."""
    day = await service.add_day(session, plan_id, context.home_id, context.user_id, payload)
    if not day:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    return day


@router.delete("/{plan_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Remove a day from a plan."""
    deleted = await service.delete_day(session, plan_id, day_id, context.home_id, context.user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found.")


@router.post(
    "/{plan_id}/days/{day_id}/exercises",
    response_model=PlanExerciseRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_exercise(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    payload: PlanExerciseCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Append a new exercise slot (with optional nested sets) to a plan day."""
    exercise = await service.add_exercise(session, plan_id, day_id, context.home_id, context.user_id, payload)
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found.")
    return exercise


@router.delete(
    "/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_exercise(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    plan_exercise_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Remove an exercise slot from a plan day."""
    deleted = await service.delete_exercise(
        session, plan_id, day_id, plan_exercise_id, context.home_id, context.user_id
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan exercise not found.")


@router.post(
    "/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets",
    response_model=PlanSetRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_set(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    plan_exercise_id: uuid.UUID,
    payload: PlanSetCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Append a new set to a plan exercise."""
    plan_set = await service.add_set(
        session, plan_id, day_id, plan_exercise_id, context.home_id, context.user_id, payload
    )
    if not plan_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan exercise not found.")
    return plan_set


@router.patch(
    "/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}",
    response_model=PlanSetRead,
)
async def update_set(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    plan_exercise_id: uuid.UUID,
    set_id: uuid.UUID,
    payload: PlanSetUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Update a plan set's target reps/weight-engine fields/warmup flag."""
    plan_set = await service.update_set(
        session, plan_id, day_id, plan_exercise_id, set_id, context.home_id, context.user_id, payload
    )
    if not plan_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan set not found.")
    return plan_set


@router.delete(
    "/{plan_id}/days/{day_id}/exercises/{plan_exercise_id}/sets/{set_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_set(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    plan_exercise_id: uuid.UUID,
    set_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Remove a set from a plan exercise."""
    deleted = await service.delete_set(
        session, plan_id, day_id, plan_exercise_id, set_id, context.home_id, context.user_id
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan set not found.")


@router.get("/{plan_id}/days/{day_id}/resolved", response_model=ResolvedDayRead)
async def get_resolved_day(
    plan_id: uuid.UUID,
    day_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve a plan day with every set's weight-engine target resolved to a concrete kg value."""
    result = await service.resolve_day(session, plan_id, day_id, context.home_id, context.user_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found.")
    day, resolved_weights = result
    return ResolvedDayRead(
        id=day.id,
        day_order=day.day_order,
        label=day.label,
        exercises=[
            ResolvedExerciseRead(
                id=pe.id,
                exercise_id=pe.exercise_id,
                exercise_order=pe.exercise_order,
                sets=[
                    ResolvedSetRead(
                        id=s.id,
                        set_order=s.set_order,
                        target_reps=s.target_reps,
                        target_weight_type=s.target_weight_type,
                        resolved_weight_kg=resolved_weights.get(s.id),
                        is_warmup=s.is_warmup,
                    )
                    for s in pe.sets
                ],
            )
            for pe in day.exercises
        ],
    )
