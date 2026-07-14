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
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/shopping"

    # Pantry Backend service integration URL
    PANTRY_BACKEND_URL: str = "http://pantry-backend:8000"


settings = Settings()
