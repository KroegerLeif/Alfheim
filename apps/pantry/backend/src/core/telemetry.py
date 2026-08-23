"""OpenTelemetry and JSON logging setup module for pantry service."""

import backend_shared.telemetry as _telemetry
from fastapi import FastAPI
from src.core.config import settings
from src.core.database import engine

JSONFormatter = _telemetry.JSONFormatter


def configure_logging(resource=None):
    return _telemetry.configure_logging(resource=resource, settings=settings)


def setup_telemetry(app: FastAPI) -> None:
    _telemetry.setup_telemetry(app, settings=settings, engine=engine)


def shutdown_telemetry() -> None:
    _telemetry.shutdown_telemetry()
