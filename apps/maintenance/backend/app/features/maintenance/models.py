"""
Maintenance feature — domain model re-exports.

This module intentionally does not define new SQLModel table classes.
The two core entities (Device, MaintenanceStep, ServiceHistoryEvent) live in
their canonical feature packages (devices and tasks). This re-export facade
gives the maintenance orchestration layer a single, stable import surface and
keeps the FDD boundary explicit.
"""

# Re-export the full device entity for use in maintenance orchestration logic.
from app.features.devices.models import Device, Household  # noqa: F401

# Re-export task-related entities used across the maintenance wizard flow.
from app.features.tasks.models import MaintenanceStep, ServiceHistoryEvent  # noqa: F401
