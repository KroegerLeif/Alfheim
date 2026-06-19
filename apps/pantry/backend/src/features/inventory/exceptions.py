class InventoryError(ValueError):
    """Base exception for all inventory-related errors."""
    pass


class IncompatibleUnitsError(InventoryError):
    """Raised when the input unit is dimensionally incompatible with the product's base unit."""
    pass


class InsufficientStockError(InventoryError):
    """Raised when an operation would cause inventory quantity to drop below zero."""
    pass
