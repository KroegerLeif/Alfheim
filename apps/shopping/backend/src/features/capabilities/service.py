"""Derive the installation's shopping capabilities from the settings."""

from src.core.config import Settings
from src.features.capabilities.schemas import ShoppingCapabilities


def get_capabilities(settings: Settings) -> ShoppingCapabilities:
    """Report which optional integrations this installation offers.

    Args:
        settings: Application settings; an empty ``PANTRY_BACKEND_URL`` means the
            Pantry app is not installed.

    Returns:
        The capabilities the frontend uses to show or hide integration controls.
    """
    return ShoppingCapabilities(pantry_available=bool(settings.PANTRY_BACKEND_URL.strip()))
