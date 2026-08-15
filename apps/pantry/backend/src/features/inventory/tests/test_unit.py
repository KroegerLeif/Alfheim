import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from src.features.inventory.models import InventoryState
from src.features.inventory.units import is_valid_unit, ureg


def test_pint_unit_conversion_math():
    """Verify that Pint converts liters to milliliters and grams to kilograms correctly."""
    liters = 1.5 * ureg.liter
    milliliters = liters.to(ureg.milliliter)
    assert milliliters.magnitude == 1500.0

    grams = 500.0 * ureg.gram
    kilograms = grams.to(ureg.kilogram)
    assert kilograms.magnitude == 0.5


def test_inventory_state_model_creation():
    """Verify that InventoryState model attributes construct with correct defaults."""
    state = InventoryState(
        product_id="00000000-0000-0000-0000-000000000001",
        location_id="00000000-0000-0000-0000-000000000002",
        quantity=50.0,
    )
    assert state.quantity == 50.0
    assert state.batch_code is None
    assert state.expiration_date is None


def test_is_valid_unit():
    """Verify unit validation helper correctly classifies valid and invalid strings."""
    assert is_valid_unit("g") is True
    assert is_valid_unit("ml") is True
    assert is_valid_unit("l") is True
    assert is_valid_unit("piece") is True
    assert is_valid_unit("pack") is True
    assert is_valid_unit("box") is True
    assert is_valid_unit("bottle") is True
    assert is_valid_unit("can") is True
    assert is_valid_unit("not_a_real_unit") is False
    assert is_valid_unit("") is False


async def test_unsupported_transaction_type(db_session: AsyncSession):
    """Verify InventoryTransactionCreate validation fails for unsupported transaction types."""
    import uuid

    from pydantic import ValidationError

    from src.features.inventory.schemas import InventoryTransactionCreate

    with pytest.raises(ValidationError) as exc:
        InventoryTransactionCreate(
            product_id=uuid.uuid4(),
            location_id=uuid.uuid4(),
            transaction_type="invalid_type",
            quantity_input=10.0,
            unit_input="piece",
        )
    assert "Input should be 'in', 'out'" in str(exc.value)
