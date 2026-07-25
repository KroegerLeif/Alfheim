"""
Custom domain exceptions for the tasks feature.
"""


class TaskError(ValueError):
    """Base exception for all task-related domain errors."""
    pass


class StepNotFoundError(TaskError):
    """Raised when a requested maintenance step is not found in the database."""
    pass


class InvalidStepError(TaskError):
    """Raised when one or more step IDs are invalid for a target device."""
    pass
