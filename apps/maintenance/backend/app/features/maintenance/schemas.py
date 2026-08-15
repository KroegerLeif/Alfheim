"""
Maintenance feature — Pydantic schemas for the wizard orchestration layer.

These schemas represent the request/response shapes specific to the
maintenance wizard workflow (multi-step service session). They deliberately
complement — not duplicate — the schemas in the tasks and devices features.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Wizard session input schemas
# ---------------------------------------------------------------------------


class WizardStepEntry(BaseModel):
    """A single completed step captured during a maintenance wizard session."""

    step_id: int = Field(..., description="Primary key of the MaintenanceStep being completed")
    comment: str | None = Field(
        default=None,
        description="Optional technician note recorded for this specific step",
    )
    supply_item_override: str | None = Field(
        default=None,
        description="Optional override for the supply item recorded during this session",
    )


class WizardSessionPayload(BaseModel):
    """Full payload submitted when a maintenance wizard session is finalised.

    The wizard UI collects device selection, completed steps, and any shopping
    items that need to be replenished before committing to the backend.
    """

    device_id: int = Field(..., description="ID of the device being serviced")
    performer: str = Field(..., min_length=1, description="Name of the person performing maintenance")
    session_notes: str | None = Field(
        default=None,
        description="Free-text notes recorded at the end of the full session",
    )
    completed_steps: list[WizardStepEntry] = Field(
        default_factory=list,
        description="Ordered list of steps completed during this session",
    )
    supply_items_to_order: list[str] | None = Field(
        default=None,
        description="Parts or consumables that need to be added to the shopping list",
    )


# ---------------------------------------------------------------------------
# Wizard session response schemas
# ---------------------------------------------------------------------------


class WizardStepResult(BaseModel):
    """Result for a single step after the wizard session has been persisted."""

    step_id: int
    title: str
    last_completed: str
    supply_needed_date: str
    model_config = ConfigDict(from_attributes=True)


class WizardSessionResult(BaseModel):
    """Full response returned after a wizard session is successfully committed."""

    history_event_id: int = Field(..., description="ID of the newly created ServiceHistoryEvent")
    device_id: int
    device_name: str
    performer: str
    session_date: str = Field(..., description="ISO 8601 date on which the session was recorded")
    completed_step_count: int = Field(..., description="Number of steps marked as completed")
    updated_steps: list[WizardStepResult] = Field(
        default_factory=list,
        description="Updated step records after recurrence timestamps were advanced",
    )
    shopping_items_forwarded: int = Field(
        default=0,
        description="Number of supply items forwarded to the shopping microservice",
    )
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Dashboard / aggregate read schemas
# ---------------------------------------------------------------------------


class MaintenanceSummary(BaseModel):
    """Lightweight per-device maintenance health snapshot used by the dashboard."""

    device_id: int
    device_name: str
    device_location: str
    total_steps: int
    overdue_steps: int
    due_soon_steps: int  # Steps due within the next 14 calendar days
    ok_steps: int
    next_service_date: str | None = Field(
        default=None,
        description="ISO 8601 date of the earliest upcoming maintenance step",
    )
    model_config = ConfigDict(from_attributes=True)


class HouseholdMaintenanceSummary(BaseModel):
    """Aggregate maintenance health for a complete household."""

    household_id: int
    household_name: str
    total_devices: int
    total_overdue: int
    total_due_soon: int
    total_ok: int
    devices: list[MaintenanceSummary] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
