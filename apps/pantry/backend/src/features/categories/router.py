import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_db_session
from src.features.locations.dependencies import (
    UserHomeContext,
    get_current_user_and_home,
)
from src.features.categories.models import (
    CategoryRead,
    CategoryCreate,
    CategoryUpdate,
)
from src.features.categories.service import CategoryService

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Create a new custom product category."""
    try:
        return await CategoryService.create_category(
            session=session,
            payload=payload,
            owner_id=context.user_id,
            home_id=context.home_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    name: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """List all categories (global + personal) for the current home space."""
    return await CategoryService.list_categories(
        session=session,
        home_id=context.home_id,
        name=name,
        limit=limit,
        offset=offset,
    )


@router.get("/{id}", response_model=CategoryRead)
async def get_category(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Get details of a specific category."""
    category = await CategoryService.get_category(
        session=session,
        category_id=id,
        home_id=context.home_id,
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    return category


@router.patch("/{id}", response_model=CategoryRead)
async def update_category(
    id: uuid.UUID,
    payload: CategoryUpdate,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Partially update an existing custom category."""
    try:
        category = await CategoryService.update_category(
            session=session,
            category_id=id,
            home_id=context.home_id,
            payload=payload,
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found.",
            )
        return category
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    context: UserHomeContext = Depends(get_current_user_and_home),
):
    """Delete a custom category."""
    try:
        deleted = await CategoryService.delete_category(
            session=session,
            category_id=id,
            home_id=context.home_id,
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found.",
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
