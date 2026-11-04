"""S3 storage service for uploading and managing game manual PDFs."""

import logging
import uuid

from backend_shared.storage import S3StorageService, generate_object_name

logger = logging.getLogger(__name__)


def build_manual_object_key(household_id: uuid.UUID, item_id: uuid.UUID) -> str:
    """Generate a tenant-isolated S3 key with a server-generated file name.

    Format: library/households/{household_id}/manuals/{item_id}/{random}.pdf
    """
    return f"library/households/{household_id}/manuals/{item_id}/{generate_object_name('pdf')}"


class ManualStorageService:
    """Service wrapping S3 operations for PDF game manuals."""

    def __init__(self, s3_service: S3StorageService | None = None) -> None:
        self.s3_service = s3_service or S3StorageService()

    async def upload_manual(
        self,
        household_id: uuid.UUID,
        item_id: uuid.UUID,
        content: bytes,
    ) -> str:
        """Upload PDF manual bytes to S3 and return the object key."""
        object_key = build_manual_object_key(household_id, item_id)
        await self.s3_service.ensure_bucket_exists()

        async with self.s3_service._get_client() as s3_client:
            await s3_client.put_object(
                Bucket=self.s3_service.settings.S3_BUCKET_NAME,
                Key=object_key,
                Body=content,
                ContentType="application/pdf",
            )

        logger.info("Successfully uploaded manual to S3: %s", object_key)
        return object_key

    async def generate_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generate presigned GET URL for downloading/viewing manual PDF."""
        return await self.s3_service.generate_presigned_download_url(object_key, expires_in=expires_in)

    async def delete_manual(self, object_key: str) -> None:
        """Delete PDF manual object from S3."""
        async with self.s3_service._get_client() as s3_client:
            await s3_client.delete_object(
                Bucket=self.s3_service.settings.S3_BUCKET_NAME,
                Key=object_key,
            )
        logger.info("Deleted manual from S3: %s", object_key)
