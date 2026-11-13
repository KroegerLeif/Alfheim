"""Alembic environment of the Workout service; the shared body is ``backend_shared.migrations.run_env``."""

from backend_shared.migrations import run_env
from sqlmodel import SQLModel
from src.core.config import settings
from src.core.migrations import load_models

load_models()
run_env(SQLModel.metadata, database_url=settings.DATABASE_URL)
