"""Schemas for library item game manual uploads and URLs."""

import uuid

from pydantic import BaseModel, Field


class ManualUploadResponse(BaseModel):
    """Response schema following manual upload."""

    item_id: uuid.UUID = Field(..., description="ID of the item.")
    manual_s3_key: str = Field(..., description="S3 object key of uploaded manual.")
    filename: str = Field(..., description="Original filename of uploaded PDF.")
    message: str = Field(default="Manual uploaded successfully.")


class ManualUrlResponse(BaseModel):
    """Response schema containing presigned download URL for manual."""

    item_id: uuid.UUID = Field(..., description="ID of the item.")
    download_url: str = Field(..., description="Presigned GET URL for viewing or downloading manual PDF.")
    expires_in: int = Field(default=3600, description="Expiration time in seconds.")
