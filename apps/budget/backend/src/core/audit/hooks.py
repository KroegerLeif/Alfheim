"""SQLAlchemy event hooks for automatic audit log generation."""

import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from src.core.audit.models import AuditLog

_audit_context: ContextVar[dict[str, Any] | None] = ContextVar("audit_context", default=None)


def set_audit_context(
    user_id: uuid.UUID | str | None = None,
    household_id: uuid.UUID | str | None = None,
) -> None:
    """Set user and household context for audit logs in the current task context."""
    user_uuid = uuid.UUID(str(user_id)) if user_id else None
    household_uuid = uuid.UUID(str(household_id)) if household_id else None
    _audit_context.set({"user_id": user_uuid, "household_id": household_uuid})


def get_audit_context() -> dict[str, Any] | None:
    """Retrieve current audit context."""
    return _audit_context.get()


def clear_audit_context() -> None:
    """Clear audit context."""
    _audit_context.set(None)


def _serialize_value(val: Any) -> Any:
    """Convert UUID, datetime, and other non-JSON types to JSON-serializable formats."""
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (dict, list, str, int, float, bool)):
        return val
    return str(val)


def _get_entity_dict(obj: Any) -> dict[str, Any]:
    """Extract column attributes and values from a model instance."""
    state = inspect(obj)
    if not state:
        return {}
    res = {}
    for attr in state.mapper.column_attrs:
        val = getattr(obj, attr.key, None)
        res[attr.key] = _serialize_value(val)
    return res


def audit_before_flush(session: Session, flush_context: Any, instances: Any) -> None:
    """SQLAlchemy before_flush listener intercepting CREATE, UPDATE, DELETE operations."""
    context = get_audit_context() or {}
    ctx_user_id = context.get("user_id")
    ctx_household_id = context.get("household_id")

    logs_to_add: list[AuditLog] = []

    # Handle CREATE (session.new)
    for obj in session.new:
        if isinstance(obj, AuditLog):
            continue
        state = inspect(obj)
        if not state:
            continue

        entity_name = obj.__class__.__name__
        entity_id_val = getattr(obj, "id", None)
        entity_id = uuid.UUID(str(entity_id_val)) if entity_id_val else None

        household_id = ctx_household_id or getattr(obj, "household_id", None)
        if isinstance(household_id, str):
            household_id = uuid.UUID(household_id)

        user_id = ctx_user_id or getattr(obj, "user_id", None)
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        new_vals = _get_entity_dict(obj)

        audit_log = AuditLog(
            household_id=household_id,
            user_id=user_id,
            action="CREATE",
            entity_name=entity_name,
            entity_id=entity_id,
            old_values=None,
            new_values=new_vals,
            timestamp=datetime.now(UTC),
        )
        logs_to_add.append(audit_log)

    # Handle UPDATE (session.dirty)
    for obj in session.dirty:
        if isinstance(obj, AuditLog):
            continue
        state = inspect(obj)
        if not state or not session.is_modified(obj, include_collections=False):
            continue

        entity_name = obj.__class__.__name__
        entity_id_val = getattr(obj, "id", None)
        entity_id = uuid.UUID(str(entity_id_val)) if entity_id_val else None

        household_id = ctx_household_id or getattr(obj, "household_id", None)
        if isinstance(household_id, str):
            household_id = uuid.UUID(household_id)

        user_id = ctx_user_id or getattr(obj, "user_id", None)
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        old_vals: dict[str, Any] = {}
        new_vals: dict[str, Any] = {}

        for attr in state.mapper.column_attrs:
            hist = state.get_history(attr.key, passive=True)
            if hist.has_changes():
                old_val = hist.deleted[0] if hist.deleted else None
                new_val = hist.added[0] if hist.added else None
                old_vals[attr.key] = _serialize_value(old_val)
                new_vals[attr.key] = _serialize_value(new_val)

        if not old_vals and not new_vals:
            continue

        audit_log = AuditLog(
            household_id=household_id,
            user_id=user_id,
            action="UPDATE",
            entity_name=entity_name,
            entity_id=entity_id,
            old_values=old_vals,
            new_values=new_vals,
            timestamp=datetime.now(UTC),
        )
        logs_to_add.append(audit_log)

    # Handle DELETE (session.deleted)
    for obj in session.deleted:
        if isinstance(obj, AuditLog):
            continue
        state = inspect(obj)
        if not state:
            continue

        entity_name = obj.__class__.__name__
        entity_id_val = getattr(obj, "id", None)
        entity_id = uuid.UUID(str(entity_id_val)) if entity_id_val else None

        household_id = ctx_household_id or getattr(obj, "household_id", None)
        if isinstance(household_id, str):
            household_id = uuid.UUID(household_id)

        user_id = ctx_user_id or getattr(obj, "user_id", None)
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        old_vals = _get_entity_dict(obj)

        audit_log = AuditLog(
            household_id=household_id,
            user_id=user_id,
            action="DELETE",
            entity_name=entity_name,
            entity_id=entity_id,
            old_values=old_vals,
            new_values=None,
            timestamp=datetime.now(UTC),
        )
        logs_to_add.append(audit_log)

    for log in logs_to_add:
        session.add(log)


def register_audit_hooks() -> None:
    """Register SQLAlchemy session listener for audit logging."""
    if not event.contains(Session, "before_flush", audit_before_flush):
        event.listen(Session, "before_flush", audit_before_flush)


__all__ = [
    "clear_audit_context",
    "get_audit_context",
    "register_audit_hooks",
    "set_audit_context",
]
