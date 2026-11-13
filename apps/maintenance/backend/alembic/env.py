"""Alembic environment of the Maintenance service; the shared body is ``backend_shared.migrations.run_env``."""

from app.core.config import settings
from app.core.migrations import load_models
from backend_shared.migrations import run_env
from sqlmodel import SQLModel

load_models()
run_env(SQLModel.metadata, database_url=settings.DATABASE_URL)
