"""OpenTelemetry and JSON logging setup module for maintenance service."""

import backend_shared.telemetry as _telemetry
from fastapi import FastAPI

from app.core.config import settings

JSONFormatter = _telemetry.JSONFormatter


def configure_logging(resource=None):
    return _telemetry.configure_logging(resource=resource, settings=settings)


def setup_telemetry(app: FastAPI) -> None:
    _telemetry.setup_telemetry(app, settings=settings)


def shutdown_telemetry() -> None:
    _telemetry.shutdown_telemetry()
