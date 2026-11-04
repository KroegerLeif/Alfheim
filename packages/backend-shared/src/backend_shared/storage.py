"""Centralized S3 object storage utility and tenant-isolated path generator."""

import logging
import os
import uuid
from collections.abc import Callable, Sequence
from typing import Protocol

import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend_shared.dependencies import is_explicit_dev_or_test_environment

logger = logging.getLogger(__name__)


class StorageSettings(BaseSettings):
    """Configuration settings for S3 / RustFS object storage integration."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    S3_ENDPOINT_URL: str = "http://rustfs:9000"
    S3_PUBLIC_URL: str = "http://api.alfheim.loegien.localhost/storage"
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET_NAME: str = "alfheim-assets"
    S3_REGION: str = "us-east-1"

    @model_validator(mode="after")
    def validate_secrets(self) -> "StorageSettings":
        """Enforce mandatory S3 secrets in non-development/testing environments."""
        base_url = (os.getenv("ALFHEIM_BASE_URL") or "").strip().rstrip("/")
        if base_url and self.S3_PUBLIC_URL == "http://api.alfheim.loegien.localhost/storage":
            self.S3_PUBLIC_URL = f"{base_url}/storage"

        if not is_explicit_dev_or_test_environment():
            if not self.S3_ACCESS_KEY:
                raise ValueError(
                    "S3_ACCESS_KEY is required in non-development environment (ENVIRONMENT must be explicitly development or test to use defaults)"
                )
            if not self.S3_SECRET_KEY:
                raise ValueError(
                    "S3_SECRET_KEY is required in non-development environment (ENVIRONMENT must be explicitly development or test to use defaults)"
                )
        else:
            if not self.S3_ACCESS_KEY:
                self.S3_ACCESS_KEY = "minioadmin"
            if not self.S3_SECRET_KEY:
                self.S3_SECRET_KEY = "minioadmin"
        return self


def get_household_object_key(household_id: str, app_name: str, filename: str) -> str:
    """Generate a tenant-isolated object storage key for shared household assets.

    Format: households/{household_id}/{app_name}/{filename}
    """
    clean_filename = filename.lstrip("/")
    return f"households/{household_id}/{app_name}/{clean_filename}"


def get_user_object_key(user_id: str, app_name: str, filename: str) -> str:
    """Generate a tenant-isolated object storage key for private user assets.

    Format: users/{user_id}/{app_name}/{filename}
    """
    clean_filename = filename.lstrip("/")
    return f"users/{user_id}/{app_name}/{clean_filename}"


DEFAULT_UPLOAD_CHUNK_SIZE = 64 * 1024


class _ChunkReader(Protocol):
    async def read(self, size: int = -1, /) -> bytes: ...


async def read_bounded_upload(
    upload: _ChunkReader,
    *,
    max_bytes: int,
    signatures: Sequence[bytes] = (),
    accept_header: Callable[[bytes], bool] | None = None,
    chunk_size: int = DEFAULT_UPLOAD_CHUNK_SIZE,
) -> bytes:
    """Read an uploaded file in chunks, refusing anything above ``max_bytes``.

    At most ``max_bytes`` plus one chunk is ever read before the upload is rejected with 413, so a
    huge request never sits fully in memory. An empty upload, or one whose first bytes match none of
    ``signatures`` (magic numbers such as ``b"%PDF-"``) or fails ``accept_header`` (for formats whose
    magic number is not a plain prefix, such as WebP or HEIC), is rejected with 400; the declared
    filename and content type are never trusted. ``accept_header`` sees the first chunk.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break
        if not chunks and (
            (signatures and not chunk.startswith(tuple(signatures))) or (accept_header and not accept_header(chunk))
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file content does not match the expected file type.",
            )
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"The uploaded file exceeds the {max_bytes // (1024 * 1024)} MiB limit.",
            )
        chunks.append(chunk)
    if not total:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file cannot be empty.")
    return b"".join(chunks)


def generate_object_name(extension: str) -> str:
    """Return a server-generated, unguessable object file name such as ``3f2a...c1.pdf``.

    Client-supplied file names never become part of an object key.
    """
    return f"{uuid.uuid4().hex}.{extension.lstrip('.').lower()}"


class S3StorageService:
    """Async S3 client provider supporting presigned URL generation and asset lifecycle operations."""

    def __init__(self, settings: StorageSettings | None = None) -> None:
        self.settings = settings or StorageSettings()
        self.session = aioboto3.Session()

    def _get_client(self, config: Config | None = None):
        return self.session.client(
            "s3",
            endpoint_url=self.settings.S3_ENDPOINT_URL,
            aws_access_key_id=self.settings.S3_ACCESS_KEY,
            aws_secret_access_key=self.settings.S3_SECRET_KEY,
            region_name=self.settings.S3_REGION,
            config=config,
        )

    def _get_presign_client(self):
        # Query-string (SigV2) signatures cover the bucket and key but not the host, so a URL signed
        # against the internal endpoint stays valid when _to_public_url moves it to the gateway.
        return self._get_client(Config(signature_version="s3"))

    def _to_public_url(self, url: str) -> str:
        """Point a URL signed for the internal endpoint at S3_PUBLIC_URL, which browsers can reach.

        The ingress gateway strips the public prefix (``/storage``) before proxying to RustFS, so the
        bucket and key path the signature covers arrive unchanged.
        """
        internal = self.settings.S3_ENDPOINT_URL.rstrip("/")
        public = self.settings.S3_PUBLIC_URL.rstrip("/")
        if public and url.startswith(internal + "/"):
            return public + url[len(internal) :]
        return url

    async def ensure_bucket_exists(self) -> None:
        """Verify that the target S3 bucket exists, creating it if absent."""
        async with self._get_client() as s3_client:
            try:
                await s3_client.head_bucket(Bucket=self.settings.S3_BUCKET_NAME)
            except ClientError as e:
                logger.info(
                    "S3 bucket '%s' not found or inaccessible (%s). Attempting creation...",
                    self.settings.S3_BUCKET_NAME,
                    e,
                )
                try:
                    await s3_client.create_bucket(Bucket=self.settings.S3_BUCKET_NAME)
                except ClientError as create_err:
                    logger.error(
                        "Failed to create S3 bucket '%s': %s",
                        self.settings.S3_BUCKET_NAME,
                        create_err,
                        exc_info=True,
                    )
                    raise

    async def put_object(self, object_key: str, body: bytes, content_type: str) -> None:
        """Store ``body`` under ``object_key`` in the configured bucket."""
        await self.ensure_bucket_exists()
        async with self._get_client() as s3_client:
            await s3_client.put_object(
                Bucket=self.settings.S3_BUCKET_NAME,
                Key=object_key,
                Body=body,
                ContentType=content_type,
            )

    async def generate_presigned_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generate a presigned GET URL allowing browser download from RustFS/S3 via S3_PUBLIC_URL."""
        async with self._get_presign_client() as s3_client:
            url: str = await s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.S3_BUCKET_NAME, "Key": object_key},
                ExpiresIn=expires_in,
            )
            return self._to_public_url(url)
