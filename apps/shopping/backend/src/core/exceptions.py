class ShoppingError(ValueError):
    """Base error class for all shopping backend validation or business logic errors.

    Contains a standardized i18n translation key to allow frontends (like next-intl)
    to dynamically localize error responses.
    """

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
    """Raised when inter-service communication with the Pantry Backend fails."""

    def __init__(self, message: str = "Pantry backend integration service error."):
        super().__init__(message, error_code="shopping.error.pantry_service_unavailable")


class InvalidUnitError(ShoppingError):
    """Raised when a unit string cannot be parsed or matched."""

    def __init__(self, message: str = "Invalid unit of measurement."):
        super().__init__(message, error_code="shopping.error.invalid_unit")
