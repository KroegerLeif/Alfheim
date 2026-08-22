"""Centralized S3 object storage utility and tenant-isolated path generator."""

import os

import aioboto3
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        env = (os.getenv("ENVIRONMENT") or "development").strip().lower()
        if env not in ("development", "dev", "testing", "test"):
            if not self.S3_ACCESS_KEY:
                raise ValueError("S3_ACCESS_KEY is required in non-development environment")
            if not self.S3_SECRET_KEY:
                raise ValueError("S3_SECRET_KEY is required in non-development environment")
        else:
            if not self.S3_ACCESS_KEY:
                self.S3_ACCESS_KEY = "minioadmin"
            if not self.S3_SECRET_KEY:
                self.S3_SECRET_KEY = "minioadmin"
        return self


def get_household_object_key(household_id: str, app_name: str, filename: str) -> str:
    """Generate a tenant-isolated object storage key for shared household assets."""
    clean_filename = filename.lstrip("/")
    return f"households/{household_id}/{app_name}/{clean_filename}"


def get_user_object_key(user_id: str, app_name: str, filename: str) -> str:
    """Generate a tenant-isolated object storage key for private user assets."""
    clean_filename = filename.lstrip("/")
    return f"users/{user_id}/{app_name}/{clean_filename}"


class S3StorageService:
    """Async S3 client provider supporting presigned URL generation and asset lifecycle operations."""

    def __init__(self, settings: StorageSettings | None = None) -> None:
        self.settings = settings or StorageSettings()
        self.session = aioboto3.Session()

    def _get_client(self):
        return self.session.client(
            "s3",
            endpoint_url=self.settings.S3_ENDPOINT_URL,
            aws_access_key_id=self.settings.S3_ACCESS_KEY,
            aws_secret_access_key=self.settings.S3_SECRET_KEY,
            region_name=self.settings.S3_REGION,
        )

    async def ensure_bucket_exists(self) -> None:
        """Verify that the target S3 bucket exists, creating it if absent."""
        async with self._get_client() as s3_client:
            try:
                await s3_client.head_bucket(Bucket=self.settings.S3_BUCKET_NAME)
            except Exception:
                await s3_client.create_bucket(Bucket=self.settings.S3_BUCKET_NAME)

    async def generate_presigned_upload_url(
        self, object_key: str, expires_in: int = 3600, content_type: str | None = None
    ) -> str:
        """Generate a presigned PUT URL allowing direct client asset upload to RustFS/S3."""
        params = {"Bucket": self.settings.S3_BUCKET_NAME, "Key": object_key}
        if content_type:
            params["ContentType"] = content_type

        async with self._get_client() as s3_client:
            url: str = await s3_client.generate_presigned_url(
                "put_object",
                Params=params,
                ExpiresIn=expires_in,
            )
            return url

    async def generate_presigned_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generate a presigned GET URL allowing client asset download from RustFS/S3."""
        async with self._get_client() as s3_client:
            url: str = await s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.S3_BUCKET_NAME, "Key": object_key},
                ExpiresIn=expires_in,
            )
            return url
