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
        """Return the primary OIDC JWKS endpoint URL.

        Uses the explicit override when configured, otherwise derives the default
        Zitadel keys endpoint from the issuer. This property performs no network
        I/O: the JWKS document is fetched and cached lazily by the PyJWKClient on
        first token verification.
        """
        if self.OIDC_JWKS_URL:
            return self.OIDC_JWKS_URL
        return f"{self.OIDC_ISSUER_URL.rstrip('/')}/keys"

    @property
    def expected_issuer(self) -> str:
        """Return expected JWT issuer URI."""
        return self.OIDC_ISSUER_URL.rstrip("/")

    @property
    def jwks_fallback_urls(self) -> list[str]:
        """Return the ordered list of candidate JWKS endpoints to try during verification."""
        base = self.OIDC_ISSUER_URL.rstrip("/")
        urls = [self.jwks_url]
        for cert_path in (
            "/keys",
            "/oauth/v2/keys",
            "/protocol/openid-connect/certs",
            "/certs",
        ):
            candidate = f"{base}{cert_path}"
            if candidate not in urls:
                urls.append(candidate)
        return urls

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "shopping-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
