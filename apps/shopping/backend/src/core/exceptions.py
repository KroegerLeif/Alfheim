"""Shopping domain errors carrying an i18n error code for the frontend."""


class ShoppingError(ValueError):
    """Base error class for all shopping backend validation or business logic errors.

    Contains a standardized i18n translation key to allow frontends (like next-intl)
    to dynamically localize error responses.
    """

    status_code: int = 400

    def __init__(self, message: str, error_code: str = "shopping.error.generic"):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


class ShoppingListNotFoundError(ShoppingError):
    """Raised when a requested shopping list does not exist or is unauthorized."""

    def __init__(self, message: str = "Shopping list not found."):
        super().__init__(message, error_code="shopping.error.list_not_found")


class ShoppingItemNotFoundError(ShoppingError):
    """Raised when a requested shopping item does not exist or is unauthorized."""

    def __init__(self, message: str = "Shopping item not found."):
        super().__init__(message, error_code="shopping.error.item_not_found")


class PantryServiceError(ShoppingError):
    """Raised when inter-service communication with the Pantry Backend fails.

    The failure is upstream, not in the caller's request, so it answers 502 Bad Gateway.
    """

    status_code = 502

    def __init__(self, message: str = "Pantry backend integration service error."):
        super().__init__(message, error_code="shopping.error.pantry_service_unavailable")


class PantryNotInstalledError(PantryServiceError):
    """Raised when Pantry is not part of this installation (empty ``PANTRY_BACKEND_URL``).

    Answers 503 Service Unavailable: the integration is switched off, not broken.
    """

    status_code = 503

    def __init__(self, message: str = "Pantry is not installed."):
        ShoppingError.__init__(self, message, error_code="shopping.error.pantry_not_installed")


class ShoppingListProtectedError(ShoppingError):
    """Raised when a caller attempts to delete a protected list (Household or Personal)."""

    def __init__(self, message: str = "This shopping list is protected and cannot be deleted."):
        super().__init__(message, error_code="shopping.error.list_protected")


class InvalidUnitError(ShoppingError):
    """Raised when a unit string cannot be parsed or matched."""

    def __init__(self, message: str = "Invalid unit of measurement."):
        super().__init__(message, error_code="shopping.error.invalid_unit")
