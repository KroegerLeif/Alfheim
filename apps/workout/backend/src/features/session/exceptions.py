class SessionValidationError(ValueError):
    """Raised for session business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""
