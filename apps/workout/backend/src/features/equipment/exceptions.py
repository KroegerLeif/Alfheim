class EquipmentValidationError(ValueError):
    """Raised for equipment business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""
