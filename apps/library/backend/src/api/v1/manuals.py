"""API endpoints for game manual PDF upload, presigned URL retrieval, and deletion."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.api.dependencies import get_current_household_id
from src.db.database import get_db_session
from src.db.models import Item
from src.schemas.manuals import ManualUploadResponse, ManualUrlResponse
from src.services.storage import ManualStorageService

router = APIRouter(prefix="/items", tags=["manuals"])


def get_manual_storage_service() -> ManualStorageService:
    """Dependency to provide ManualStorageService instance."""
    return ManualStorageService()


async def _get_item_or_404(
    item_id: uuid.UUID,
    household_id: uuid.UUID,
    session: AsyncSession,
) -> Item:
    """Retrieve item by ID for household or raise 404 HTTP Exception."""
    statement = select(Item).where(
        Item.id == item_id,
        Item.household_id == household_id,
    )
    result = await session.execute(statement)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID '{item_id}' not found.",
        )
    return item


@router.post(
    "/{item_id}/manual",
    response_model=ManualUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload PDF game manual",
)
async def upload_manual(
    item_id: uuid.UUID,
    file: UploadFile = File(...),
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
    storage_service: ManualStorageService = Depends(get_manual_storage_service),
) -> Any:
    """Upload a PDF game manual for a media item."""
    item = await _get_item_or_404(item_id, household_id, session)

    filename = file.filename or "manual.pdf"
    if not filename.lower().endswith(".pdf") or (file.content_type and file.content_type != "application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed for game manuals.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded manual PDF file cannot be empty.",
        )

    s3_key = await storage_service.upload_manual(
        household_id=household_id,
        item_id=item_id,
        filename=filename,
        content=content,
    )

    item.manual_s3_key = s3_key
    session.add(item)
    await session.commit()
    await session.refresh(item)

    return ManualUploadResponse(
        item_id=item.id,
        manual_s3_key=s3_key,
        filename=filename,
        message="Manual uploaded successfully.",
    )


@router.get(
    "/{item_id}/manual/url",
    response_model=ManualUrlResponse,
    summary="Get presigned download URL for PDF manual",
)
async def get_manual_presigned_url(
    item_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
    storage_service: ManualStorageService = Depends(get_manual_storage_service),
) -> Any:
    """Generate a presigned GET URL for viewing or downloading the PDF game manual."""
    item = await _get_item_or_404(item_id, household_id, session)

    if not item.manual_s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No manual uploaded for item '{item_id}'.",
        )

    download_url = await storage_service.generate_download_url(item.manual_s3_key)
    return ManualUrlResponse(
        item_id=item.id,
        download_url=download_url,
        expires_in=3600,
    )


@router.delete(
    "/{item_id}/manual",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete uploaded game manual",
)
async def delete_manual(
    item_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_current_household_id),
    session: AsyncSession = Depends(get_db_session),
    storage_service: ManualStorageService = Depends(get_manual_storage_service),
) -> None:
    """Delete uploaded PDF manual for a media item."""
    item = await _get_item_or_404(item_id, household_id, session)

    if not item.manual_s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No manual uploaded for item '{item_id}'.",
        )

    await storage_service.delete_manual(item.manual_s3_key)
    item.manual_s3_key = None
    session.add(item)
    await session.commit()
