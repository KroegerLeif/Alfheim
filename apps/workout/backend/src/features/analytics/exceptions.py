class AnalyticsValidationError(ValueError):
    """Raised for analytics business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""
