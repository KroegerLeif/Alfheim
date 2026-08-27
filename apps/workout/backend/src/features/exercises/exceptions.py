class ExerciseValidationError(ValueError):
    """Raised for exercise business-rule violations (mapped to HTTP 400 by the global ValueError handler)."""
