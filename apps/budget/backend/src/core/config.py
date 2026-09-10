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
    DEBUG: bool = True

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://alfheim.loegien.localhost",
        "http://api.alfheim.loegien.localhost",
    ]

    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://budget_user:postgres@localhost:5432/alfheim_budget"

    # Generic OIDC authentication settings
    OIDC_ISSUER_URL: str = "http://api.alfheim.loegien.localhost/auth"
    OIDC_AUDIENCE: str = "alfheim"


settings = Settings()
