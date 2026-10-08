class SessionValidationError(ValueError):
    """Raised for session business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""


class SessionNotActiveError(SessionValidationError):
    """Raised when a set is synced into a session that is no longer active.

    The router maps it to HTTP 409 with the machine-readable code ``session_not_active``
    so the offline queue can stop retrying entries that can never be accepted.
    """

    code = "session_not_active"
