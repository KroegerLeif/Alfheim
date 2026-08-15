class ChoreError(ValueError):
    """Base exception for all chore-related errors."""


class ChoreTemplateNotFoundError(ChoreError):
    """Raised when a chore template is not found."""


class ChoreInstanceNotFoundError(ChoreError):
    """Raised when a chore instance is not found."""


class ChoreAlreadyCompletedError(ChoreError):
    """Raised when an action is performed on an already completed chore."""


class ChoreNotAssignableError(ChoreError):
    """Raised when a chore instance cannot be assigned."""


class HouseholdStreakNotFoundError(ChoreError):
    """Raised when household streak registry is not found."""


class DuplicateChoreTemplateError(ChoreError):
    """Raised when a chore template name conflict is detected within a household."""
