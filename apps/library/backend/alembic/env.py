"""Alembic environment of the Library service; the shared body is ``backend_shared.migrations.run_env``."""

from backend_shared.migrations import run_env
from sqlmodel import SQLModel
from src.config import settings
from src.db.migrations import include_object, load_models

load_models()
run_env(SQLModel.metadata, database_url=settings.DATABASE_URL, include_object=include_object)
