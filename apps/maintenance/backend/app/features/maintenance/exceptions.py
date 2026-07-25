"""
Custom domain exceptions for the maintenance feature.
"""


class MaintenanceError(ValueError):
    """Base exception for all maintenance domain errors."""
    pass


class WizardValidationError(MaintenanceError):
    """Raised when wizard session validation fails."""
    pass
