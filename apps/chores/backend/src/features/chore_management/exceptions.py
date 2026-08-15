class ChoreError(ValueError):
    """Base exception for all chore-related errors."""

    pass


class ChoreTemplateNotFoundError(ChoreError):
    """Raised when a chore template is not found."""

    pass


class ChoreInstanceNotFoundError(ChoreError):
    """Raised when a chore instance is not found."""

    pass


class ChoreAlreadyCompletedError(ChoreError):
    """Raised when an action is performed on an already completed chore."""

    pass


class ChoreNotAssignableError(ChoreError):
    """Raised when a chore instance cannot be assigned."""

    pass


class HouseholdStreakNotFoundError(ChoreError):
    """Raised when household streak registry is not found."""

    pass


class DuplicateChoreTemplateError(ChoreError):
    """Raised when a chore template name conflict is detected within a household."""

    pass
