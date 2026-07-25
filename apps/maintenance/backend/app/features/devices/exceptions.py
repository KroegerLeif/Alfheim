"""
Custom domain exceptions for the devices feature.
"""


class DeviceError(ValueError):
    """Base exception for all device-related domain errors."""
    pass


class DeviceNotFoundError(DeviceError):
    """Raised when a requested device is not found in the database."""
    pass


class HouseholdNotFoundError(DeviceError):
    """Raised when a referenced household does not exist."""
    pass
