import json
import logging
import urllib.request

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Workout Tracker"
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
    DATABASE_URL: str = "postgresql+asyncpg://workout_user:postgres@localhost:5432/alfheim_workout"

    # Generic OIDC Configuration (Zitadel)
    OIDC_ISSUER_URL: str = "http://auth.alfheim.loegien.localhost"
    OIDC_AUDIENCE: str = "alfheim"
    OIDC_JWKS_URL: str = ""

    @property
    def jwks_url(self) -> str:
        if self.OIDC_JWKS_URL:
            return self.OIDC_JWKS_URL
        issuer = self.OIDC_ISSUER_URL.rstrip("/")
        discovery_url = f"{issuer}/.well-known/openid-configuration"
        try:
            req = urllib.request.Request(discovery_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if "jwks_uri" in data:
                        return data["jwks_uri"]
        except Exception as e:
            logger.debug("OIDC discovery failed for %s: %s", discovery_url, e)
        return f"{issuer}/keys"

    @property
    def expected_issuer(self) -> str:
        return self.OIDC_ISSUER_URL.rstrip("/")

    @property
    def jwks_fallback_urls(self) -> list[str]:
        urls = [self.jwks_url]
        base = self.OIDC_ISSUER_URL.rstrip("/")
        for cert_path in [
            "/keys",
            "/oauth/v2/keys",
            "/protocol/openid-connect/certs",
            "/certs",
        ]:
            url = f"{base}{cert_path}"
            if url not in urls:
                urls.append(url)
        return urls

    # OpenTelemetry Configuration
    OTEL_ENABLED: bool = False
    OTEL_SERVICE_NAME: str = "workout-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True


settings = Settings()
