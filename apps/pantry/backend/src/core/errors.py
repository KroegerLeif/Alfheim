"""Stable, machine-readable error payloads for conflicts reported by the Pantry API.

Conflict responses follow the household error contract: ``{"detail": {"code", "message", ...}}``.
The ``code`` is stable and mapped to localized text by the frontend; ``message`` is English and
meant for logs and API consumers.
"""

from typing import Any

CODE_CATEGORY_IN_USE = "category_in_use"
CODE_LOCATION_IN_USE = "location_in_use"
CODE_PRODUCT_IN_USE = "product_in_use"


class ResourceInUseError(ValueError):
    """Raised when a delete is refused because other records still reference the resource.

    It subclasses ``ValueError`` so callers that already translate ``ValueError`` into a plain
    error message (the MCP tools) keep working; the REST layer registers a dedicated handler that
    maps it to ``409 Conflict`` with a structured ``detail`` object.
    """

    def __init__(self, code: str, message: str, item_count: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.item_count = item_count

    def to_detail(self) -> dict[str, Any]:
        """Build the ``detail`` object of the 409 response."""
        return {"code": self.code, "message": self.message, "item_count": self.item_count}
