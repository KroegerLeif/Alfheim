from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Chores Tracker"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database connection URL (must be an asyncpg URL for async SQLAlchemy)
    DATABASE_URL: str = "postgresql+asyncpg://chores_user:postgres@localhost:5432/alfheim_chores"

    # Generic OIDC Configuration
    OIDC_ISSUER_URL: str = "http://localhost:8080"
    OIDC_AUDIENCE: str = "alfheim"
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        if self.OIDC_JWKS_URL:
            return self.OIDC_JWKS_URL
        base = self.OIDC_ISSUER_URL.rstrip("/")
        return f"{base}/keys"

    @property
    def expected_issuer(self) -> str:
        return self.OIDC_ISSUER_URL.rstrip("/")

    @property
    def jwks_fallback_urls(self) -> list[str]:
        urls = []
        if self.jwks_url:
            urls.append(self.jwks_url)
        for base_url in [
            self.OIDC_ISSUER_URL,
            "http://localhost:8080",
            "http://zitadel:8080",
            "http://api.alfheim.loegien.localhost/auth",
        ]:
            if not base_url:
                continue
            cleaned = base_url.rstrip("/")
            candidate_keys = f"{cleaned}/keys"
            if candidate_keys not in urls:
                urls.append(candidate_keys)
            candidate_certs = f"{cleaned}/protocol/openid-connect/certs"
            if candidate_certs not in urls:
                urls.append(candidate_certs)
        return urls

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "chores-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
