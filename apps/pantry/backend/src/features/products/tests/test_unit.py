import uuid

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.categories.models import Category
from src.features.products.models import BaseUnit, Product, ProductNutrition
from src.features.products.schemas import ProductCreate, ProductNutritionUpdate, ProductUpdate
from src.features.products.service import ProductService


def test_product_model_defaults():
    """Verify that Product model attributes have correct default values."""
    prod = Product(name="Test Jam", base_unit=BaseUnit.G)
    assert prod.minimum_stock == 0.0
    assert prod.is_global is False
    assert prod.brand is None
    assert prod.barcode is None
    assert prod.image_url is None
    assert prod.home_id is None
    assert prod.category_id is None


def test_product_nutrition_model_creation():
    """Verify that ProductNutrition model attributes bind correctly."""
    nut = ProductNutrition(
        calories=100.0,
        fat=2.5,
        saturated_fat=0.5,
        carbohydrates=15.0,
        sugars=10.0,
        protein=3.0,
        salt=0.1,
    )
    assert nut.calories == 100.0
    assert nut.fat == 2.5
    assert nut.saturated_fat == 0.5
    assert nut.carbohydrates == 15.0
    assert nut.sugars == 10.0
    assert nut.protein == 3.0
    assert nut.salt == 0.1


def test_product_create_schema_validation():
    """Verify that ProductCreate schema validates inputs appropriately."""
    schema = ProductCreate(
        name="Mock Oats",
        brand="OatCompany",
        barcode="123456789",
        base_unit=BaseUnit.ML,
        minimum_stock=100.0,
    )
    assert schema.name == "Mock Oats"
    assert schema.brand == "OatCompany"
    assert schema.barcode == "123456789"
    assert schema.base_unit == BaseUnit.ML
    assert schema.minimum_stock == 100.0


async def test_get_product_missing(db_session: AsyncSession):
    """Verify ProductService returns None for non-existent product."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await ProductService.get_product(db_session, fake_id, home_id)
    assert res is None


async def test_get_product_nutrition_missing(db_session: AsyncSession):
    """Verify ProductService returns None for non-existent product nutrition profile."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await ProductService.get_product_nutrition(db_session, fake_id, home_id)
    assert res is None


async def test_create_product_duplicate_barcode(db_session: AsyncSession):
    """Verify ProductService prevents creating a product with duplicate barcode."""
    home_id = uuid.uuid4()
    payload1 = ProductCreate(name="Prod 1", barcode="11111111", base_unit=BaseUnit.PIECE)
    await ProductService.create_product(db_session, payload1, home_id)

    payload2 = ProductCreate(name="Prod 2", barcode="11111111", base_unit=BaseUnit.PIECE)
    with pytest.raises(ValueError) as exc:
        await ProductService.create_product(db_session, payload2, home_id)
    assert "already exists" in str(exc.value)


async def test_get_or_create_by_barcode_no_client(db_session: AsyncSession):
    """Verify get_or_create_by_barcode returns None if client is missing and barcode is not local."""
    home_id = uuid.uuid4()
    res = await ProductService.get_or_create_by_barcode(db_session, "99999999", home_id, off_client=None)
    assert res is None


async def test_get_or_create_by_barcode_global_clash(db_session: AsyncSession):
    """Verify get_or_create_by_barcode returns None if barcode exists in another home (global clash)."""
    home_id1 = uuid.uuid4()
    home_id2 = uuid.uuid4()

    # Manually insert a local product with a barcode to simulate a non-global clash
    local_prod = Product(
        name="Local Jam",
        barcode="12345",
        base_unit=BaseUnit.G,
        is_global=False,
        home_id=home_id1,
    )
    db_session.add(local_prod)
    await db_session.commit()

    # Lookup from home 2
    res = await ProductService.get_or_create_by_barcode(db_session, "12345", home_id2, off_client=None)
    assert res is None


async def test_update_product_missing(db_session: AsyncSession):
    """Verify ProductService returns None when updating non-existent product."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await ProductService.update_product(db_session, fake_id, home_id, ProductUpdate(name="Test"))
    assert res is None


async def test_update_product_global_blocked(db_session: AsyncSession):
    """Verify ProductService blocks updates to global products."""
    home_id = uuid.uuid4()
    global_prod = Product(name="Global Product", is_global=True, base_unit=BaseUnit.PIECE)
    db_session.add(global_prod)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await ProductService.update_product(db_session, global_prod.id, home_id, ProductUpdate(name="Altered"))
    assert "Global products cannot be modified" in str(exc.value)


async def test_update_product_barcode_clash(db_session: AsyncSession):
    """Verify ProductService prevents updating a product barcode to an existing one."""
    home_id = uuid.uuid4()
    # p1 is global because it has a barcode
    await ProductService.create_product(
        db_session, ProductCreate(name="P1", barcode="100", base_unit=BaseUnit.PIECE), home_id
    )
    # p2 is local because it has no barcode
    p2 = await ProductService.create_product(
        db_session, ProductCreate(name="P2", barcode=None, base_unit=BaseUnit.PIECE), home_id
    )

    # Attempting to assign p1's barcode to p2 should raise ValueError (already exists)
    with pytest.raises(ValueError) as exc:
        await ProductService.update_product(db_session, p2.id, home_id, ProductUpdate(barcode="100"))
    assert "already exists" in str(exc.value)


async def test_update_product_unauthorized_category(db_session: AsyncSession):
    """Verify ProductService rejects setting an unauthorized category on update."""
    home_id1 = uuid.uuid4()
    home_id2 = uuid.uuid4()

    # Create category in home 2
    cat_home2 = Category(name="Secret Category", home_id=home_id2, is_global=False)
    db_session.add(cat_home2)
    await db_session.commit()

    # Create product in home 1
    p1 = await ProductService.create_product(
        db_session, ProductCreate(name="Product 1", base_unit=BaseUnit.PIECE), home_id1
    )

    # Attempt to assign home 2's category to home 1's product
    with pytest.raises(ValueError) as exc:
        await ProductService.update_product(db_session, p1.id, home_id1, ProductUpdate(category_id=cat_home2.id))
    assert "not found or not authorized" in str(exc.value)


async def test_update_product_nutrition_global_blocked(db_session: AsyncSession):
    """Verify ProductService blocks updating nutrition on global products."""
    home_id = uuid.uuid4()
    global_prod = Product(name="Global Product", is_global=True, base_unit=BaseUnit.PIECE)
    db_session.add(global_prod)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await ProductService.update_product_nutrition(
            db_session, global_prod.id, home_id, ProductNutritionUpdate(calories=50.0)
        )
    assert "Global product nutrition cannot be modified" in str(exc.value)


async def test_update_product_nutrition_missing(db_session: AsyncSession):
    """Verify ProductService returns None when updating nutrition for non-existent product."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await ProductService.update_product_nutrition(
        db_session, fake_id, home_id, ProductNutritionUpdate(calories=50.0)
    )
    assert res is None


async def test_delete_product_missing(db_session: AsyncSession):
    """Verify ProductService returns False when deleting non-existent product."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await ProductService.delete_product(db_session, fake_id, home_id)
    assert res is False


async def test_delete_product_global_blocked(db_session: AsyncSession):
    """Verify ProductService blocks deleting global products."""
    home_id = uuid.uuid4()
    global_prod = Product(name="Global Product", is_global=True, base_unit=BaseUnit.PIECE)
    db_session.add(global_prod)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await ProductService.delete_product(db_session, global_prod.id, home_id)
    assert "Global products cannot be deleted" in str(exc.value)
