from backend_shared.oidc_discovery import resolve_jwks_url
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Shopping Organizer"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security: Restrict allowed origins for CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://alfheim.loegien.localhost",
        "http://api.alfheim.loegien.localhost",
    ]

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://shopping_user:postgres@localhost:5432/alfheim_shopping"

    # Pantry Backend service integration URL
    PANTRY_BACKEND_URL: str = "http://pantry-backend:8000"

    # Generic OIDC Configuration (Zitadel)
    OIDC_ISSUER_URL: str = "http://auth.alfheim.loegien.localhost"
    OIDC_AUDIENCE: str = "alfheim"
    # Optional explicit JWKS endpoint override. When empty the endpoint is
    # derived from the issuer without any network call.
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        """Return the OIDC JWKS endpoint URL.

        Uses the explicit override when configured, otherwise resolves the
        endpoint via OIDC discovery (``{issuer}/.well-known/openid-configuration``),
        cached per issuer.
        """
        return resolve_jwks_url(self.OIDC_ISSUER_URL, self.OIDC_JWKS_URL or None)

    @property
    def expected_issuer(self) -> str:
        """Return expected JWT issuer URI."""
        return self.OIDC_ISSUER_URL.rstrip("/")

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "shopping-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
