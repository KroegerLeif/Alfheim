import uuid
from typing import Optional, list
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.core.dependencies import (
    UserHomeContext,
    get_current_user_and_home,
)
from src.features.chore_management.schemas import (
    ChoreTemplateCreate,
    ChoreTemplateUpdate,
    ChoreTemplateRead,
    ChoreInstanceRead,
    ChoreAssignRequest,
    ChoreCompleteRequest,
    ChoreIntegrationSummary,
)
from src.features.chore_management.service import ChoreService

router = APIRouter(prefix="/api/v1/chores", tags=["chores"])


@router.post("/templates", response_model=ChoreTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_chore_template(
    payload: ChoreTemplateCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new chore template blueprint."""
    return await ChoreService.create_chore_template(
        session=session,
        payload=payload,
        home_id=context.home_id,
    )


@router.get("/templates", response_model=list[ChoreTemplateRead])
async def list_chore_templates(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List all chore templates registered in the household."""
    return await ChoreService.list_chore_templates(
        session=session,
        home_id=context.home_id,
        limit=limit,
        offset=offset,
    )


@router.get("/templates/{id}", response_model=ChoreTemplateRead)
async def get_chore_template(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Get a specific chore template's details."""
    template = await ChoreService.get_chore_template(
        session=session,
        template_id=id,
        home_id=context.home_id,
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chore template not found.",
        )
    return template


@router.patch("/templates/{id}", response_model=ChoreTemplateRead)
async def update_chore_template(
    id: uuid.UUID,
    payload: ChoreTemplateUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an existing chore template."""
    return await ChoreService.update_chore_template(
        session=session,
        template_id=id,
        payload=payload,
        home_id=context.home_id,
    )


@router.delete("/templates/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chore_template(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a chore template from the household."""
    await ChoreService.delete_chore_template(
        session=session,
        template_id=id,
        home_id=context.home_id,
    )


@router.get("/today", response_model=list[ChoreInstanceRead])
async def get_today_chores(
    due_date: Optional[date] = None,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve all chore instances for today (or custom due date) in the household context."""
    return await ChoreService.get_today_chores(
        session=session,
        home_id=context.home_id,
        due_date=due_date,
    )


@router.post("/instances/{id}/assign", response_model=ChoreInstanceRead)
async def assign_chore_instance(
    id: uuid.UUID,
    payload: ChoreAssignRequest,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Assign a chore instance to a household member."""
    return await ChoreService.assign_chore_instance(
        session=session,
        instance_id=id,
        payload=payload,
        home_id=context.home_id,
    )


@router.post("/instances/{id}/complete", response_model=ChoreInstanceRead)
async def complete_chore_instance(
    id: uuid.UUID,
    payload: Optional[ChoreCompleteRequest] = None,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Mark a chore instance as completed."""
    completed_by = payload.completed_by if payload and payload.completed_by else context.user_id
    return await ChoreService.complete_chore_instance(
        session=session,
        instance_id=id,
        completed_by=completed_by,
        home_id=context.home_id,
    )


@router.get("/integrations/summary", response_model=ChoreIntegrationSummary)
async def get_integrations_summary(
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Get metrics and completion statistics of today's chores for dashboard widgets."""
    return await ChoreService.get_integrations_summary(
        session=session,
        home_id=context.home_id,
    )
