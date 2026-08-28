"""Package initialization for audit core module."""

from src.core.audit.hooks import (
    clear_audit_context,
    get_audit_context,
    register_audit_hooks,
    set_audit_context,
)
from src.core.audit.models import AuditLog
from src.core.audit.repository import AuditRepository

# Automatically register event hooks on module import
register_audit_hooks()

__all__ = [
    "AuditLog",
    "AuditRepository",
    "clear_audit_context",
    "get_audit_context",
    "register_audit_hooks",
    "set_audit_context",
]
