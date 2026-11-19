"""Environment-driven settings for the Budget service."""

from backend_shared.cors import DEV_CORS_ORIGINS, CorsOrigins
from backend_shared.oidc_discovery import resolve_jwks_url
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for the Budget microservice."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Budget & Treasury Service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    # Log every SQL statement (separate from DEBUG: statements may contain personal data)
    SQL_ECHO: bool = False

    # CORS allowlist (#921): comma-separated or JSON, validated; unset means the dev hosts in
    # development and no cross-origin access in production (see backend_shared.cors).
    CORS_ORIGINS: CorsOrigins = list(DEV_CORS_ORIGINS)

    # Largest accepted receipt upload in bytes (default 10 MiB)
    MAX_RECEIPT_UPLOAD_BYTES: int = 10 * 1024 * 1024

    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://budget_user:postgres@localhost:5432/alfheim_budget"

    # Generic OIDC authentication settings
    OIDC_ISSUER_URL: str = "http://api.alfheim.loegien.localhost/auth"
    OIDC_AUDIENCE: str = "alfheim"
    # Optional explicit JWKS endpoint override. When empty the endpoint is
    # resolved via OIDC discovery from the issuer.
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Return the OIDC JWKS endpoint URL (explicit override or OIDC discovery, cached per issuer)."""
        return resolve_jwks_url(self.OIDC_ISSUER_URL, self.OIDC_JWKS_URL or None)

    @property
    def expected_issuer(self) -> str:
        """Return expected JWT issuer URI."""
        return self.OIDC_ISSUER_URL.rstrip("/")


settings = Settings()
