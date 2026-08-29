class PlanValidationError(ValueError):
    """Raised for plan business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""
