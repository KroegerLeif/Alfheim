"""Response schemas of the capabilities feature."""

from pydantic import BaseModel


class ShoppingCapabilities(BaseModel):
    """Optional integrations available in this installation.

    Attributes:
        pantry_available: Whether a Pantry backend is configured. When false the
            frontend hides the low-stock import and the sync to Pantry.
    """

    pantry_available: bool
