import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.core.dependencies import UserHomeContext, get_current_user_and_home
from src.features.equipment.schemas import EquipmentCreate, EquipmentRead, EquipmentUpdate
from src.features.equipment.service import EquipmentService

router = APIRouter(prefix="/api/v1/equipment", tags=["equipment"])


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new household- or user-scoped equipment entry."""
    return await EquipmentService.create_equipment(
        session=session,
        payload=payload,
        home_id=context.home_id,
        user_id=context.user_id,
    )


@router.get("", response_model=list[EquipmentRead])
async def list_equipment(
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List all equipment visible to the caller: system + own household + own user entries."""
    return await EquipmentService.list_equipment(
        session=session,
        home_id=context.home_id,
        user_id=context.user_id,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.get("/{id}", response_model=EquipmentRead)
async def get_equipment(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Retrieve details for a specific equipment entry by ID."""
    equipment = await EquipmentService.get_equipment(
        session=session,
        equipment_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
    )
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found.")
    return equipment


@router.patch("/{id}", response_model=EquipmentRead)
async def update_equipment(
    id: uuid.UUID,
    payload: EquipmentUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an equipment entry the caller owns. System entries cannot be modified."""
    equipment = await EquipmentService.update_equipment(
        session=session,
        equipment_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
        payload=payload,
    )
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found.")
    return equipment


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete an equipment entry the caller owns. System entries cannot be deleted."""
    deleted = await EquipmentService.delete_equipment(
        session=session,
        equipment_id=id,
        home_id=context.home_id,
        user_id=context.user_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found.")
