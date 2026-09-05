import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.categories.models import Category, CategoryCreate, CategoryUpdate
from src.features.categories.service import CategoryService
from src.features.inventory.exceptions import InsufficientStockError, InventoryError
from src.features.inventory.models import InventoryTransactionType
from src.features.inventory.schemas import (
    BulkAddInventoryPayload,
    BulkAddProductItem,
    InventoryTransactionCreate,
)
from src.features.inventory.service import InventoryService
from src.features.locations.models import Location, LocationCreate, LocationUpdate
from src.features.locations.service import LocationService
from src.features.products.models import BaseUnit, Product
from src.features.products.schemas import ProductCreate, ProductUpdate
from src.features.products.service import ProductService


async def test_inventory_service_errors(db_session: AsyncSession):
    """Verify inventory transaction validation, stock limits, and integrity handling."""
    home_id = uuid.uuid4()

    # 1. Product not found
    with pytest.raises(InventoryError, match="Product with ID .* not found"):
        await InventoryService.create_transaction(
            db_session,
            InventoryTransactionCreate(
                product_id=uuid.uuid4(),
                location_id=uuid.uuid4(),
                transaction_type=InventoryTransactionType.IN,
                quantity_input=10.0,
                unit_input="g",
            ),
            home_id,
        )

    # Setup valid product
    product = Product(
        name="Test Sugar",
        base_unit=BaseUnit.G,
        home_id=home_id,
        is_global=False,
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)

    # 2. Location not found
    with pytest.raises(InventoryError, match="Location with ID .* not found"):
        await InventoryService.create_transaction(
            db_session,
            InventoryTransactionCreate(
                product_id=product.id,
                location_id=uuid.uuid4(),
                transaction_type=InventoryTransactionType.IN,
                quantity_input=10.0,
                unit_input="g",
            ),
            home_id,
        )

    # Setup valid location
    location = Location(
        name="Kitchen Cabinet",
        home_id=home_id,
        is_system=False,
    )
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)

    # 3. Insufficient stock on OUT
    with pytest.raises(InsufficientStockError, match="Insufficient stock"):
        await InventoryService.create_transaction(
            db_session,
            InventoryTransactionCreate(
                product_id=product.id,
                location_id=location.id,
                transaction_type=InventoryTransactionType.OUT,
                quantity_input=50.0,
                unit_input="g",
            ),
            home_id,
        )

    # 4. Add stock, then reduce exactly to 0 to trigger cache deletion
    await InventoryService.create_transaction(
        db_session,
        InventoryTransactionCreate(
            product_id=product.id,
            location_id=location.id,
            transaction_type=InventoryTransactionType.IN,
            quantity_input=100.0,
            unit_input="g",
        ),
        home_id,
    )

    state_before = await InventoryService.get_current_state(
        db_session, home_id, product_id=product.id, location_id=location.id
    )
    assert len(state_before) == 1
    assert state_before[0].quantity == 100.0

    # Reduce exactly 100g out
    await InventoryService.create_transaction(
        db_session,
        InventoryTransactionCreate(
            product_id=product.id,
            location_id=location.id,
            transaction_type=InventoryTransactionType.OUT,
            quantity_input=100.0,
            unit_input="g",
        ),
        home_id,
    )

    state_after = await InventoryService.get_current_state(
        db_session, home_id, product_id=product.id, location_id=location.id
    )
    assert len(state_after) == 0

    # 5. Integrity error on commit
    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(InventoryError, match="Database error during transaction creation"):
            await InventoryService.create_transaction(
                db_session,
                InventoryTransactionCreate(
                    product_id=product.id,
                    location_id=location.id,
                    transaction_type=InventoryTransactionType.IN,
                    quantity_input=10.0,
                    unit_input="g",
                ),
                home_id,
            )


async def test_bulk_add_missing_backlog_and_exception_handling(db_session: AsyncSession):
    """Verify bulk_add_items behavior when system location is absent or barcode lookup fails."""
    fresh_home_id = uuid.uuid4()
    item_id = uuid.uuid4()
    payload = BulkAddInventoryPayload(
        items=[
            BulkAddProductItem(
                shopping_item_id=item_id,
                name="Apples",
                brand="Farm",
                barcode="999999999999",
                quantity=2.0,
                unit="piece",
            )
        ]
    )

    # 1. No system Backlog location seeded for fresh_home_id
    res = await InventoryService.bulk_add_items(db_session, payload, fresh_home_id)
    assert len(res.successful_items) == 0
    assert len(res.unrecognized_items) == 1
    assert res.unrecognized_items[0].reason == "pantry.error.system_location_missing"

    # Seed backlog for home
    backlog = Location(name="Backlog", home_id=fresh_home_id, is_system=True)
    db_session.add(backlog)
    await db_session.commit()

    # 2. Barcode lookup throws exception -> fallback to name match (or unrecognized)
    with patch(
        "src.features.products.service.ProductService.get_or_create_by_barcode", side_effect=Exception("API Down")
    ):
        res2 = await InventoryService.bulk_add_items(db_session, payload, fresh_home_id)
        assert len(res2.successful_items) == 0
        assert len(res2.unrecognized_items) == 1
        assert res2.unrecognized_items[0].reason == "pantry.error.product_not_found"


async def test_category_service_and_router_errors(client: AsyncClient, db_session: AsyncSession):
    """Verify category errors, global protection, and 404 router paths."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    cat = await CategoryService.create_category(
        db_session,
        CategoryCreate(name="Baking", description="Flour and sugar"),
        owner_id,
        home_id,
    )
    assert cat.id is not None

    # Duplicate name check
    with pytest.raises(ValueError, match="already exists for this home"):
        await CategoryService.create_category(
            db_session,
            CategoryCreate(name="Baking"),
            owner_id,
            home_id,
        )

    # Global category protection
    global_cat = Category(name="Global Dairy", is_global=True, owner_id=None, home_id=None)
    db_session.add(global_cat)
    await db_session.commit()
    await db_session.refresh(global_cat)
    global_cat_id = global_cat.id

    with pytest.raises(ValueError, match="Global categories cannot be modified"):
        await CategoryService.update_category(db_session, global_cat_id, home_id, CategoryUpdate(name="Renamed Dairy"))

    with pytest.raises(ValueError, match="Global categories cannot be deleted"):
        await CategoryService.delete_category(db_session, global_cat_id, home_id)

    # Missing category
    assert await CategoryService.get_category(db_session, uuid.uuid4(), home_id) is None
    assert await CategoryService.update_category(db_session, uuid.uuid4(), home_id, CategoryUpdate(name="Test")) is None
    assert await CategoryService.delete_category(db_session, uuid.uuid4(), home_id) is False

    # Router 404s
    random_id = uuid.uuid4()
    res = await client.get(f"/api/v1/categories/{random_id}")
    assert res.status_code == 404
    res = await client.patch(f"/api/v1/categories/{random_id}", json={"name": "New Cat"})
    assert res.status_code == 404
    res = await client.delete(f"/api/v1/categories/{random_id}")
    assert res.status_code == 404


async def test_location_service_and_router_errors(client: AsyncClient, db_session: AsyncSession):
    """Verify location errors, system location protection, and 404 router paths."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    loc = await LocationService.create_location(
        db_session,
        LocationCreate(name="Cellar", description="Cold storage"),
        owner_id,
        home_id,
    )
    assert loc.id is not None

    # System location protection
    sys_loc = Location(name="Backlog Shelf", is_system=True, home_id=home_id)
    db_session.add(sys_loc)
    await db_session.commit()
    await db_session.refresh(sys_loc)
    sys_loc_id = sys_loc.id

    with pytest.raises(ValueError, match="System locations cannot be modified or deleted"):
        await LocationService.update_location(db_session, sys_loc_id, home_id, LocationUpdate(name="Renamed"))

    with pytest.raises(ValueError, match="System locations cannot be modified or deleted"):
        await LocationService.delete_location(db_session, sys_loc_id, home_id)

    # Missing location
    assert await LocationService.get_location(db_session, uuid.uuid4(), home_id) is None
    assert await LocationService.update_location(db_session, uuid.uuid4(), home_id, LocationUpdate(name="Test")) is None
    assert await LocationService.delete_location(db_session, uuid.uuid4(), home_id) is False

    # Router 404s
    random_id = uuid.uuid4()
    res = await client.get(f"/api/v1/locations/{random_id}")
    assert res.status_code == 404
    res = await client.patch(f"/api/v1/locations/{random_id}", json={"name": "New Loc"})
    assert res.status_code == 404
    res = await client.delete(f"/api/v1/locations/{random_id}")
    assert res.status_code == 404


async def test_product_service_and_router_errors(client: AsyncClient, db_session: AsyncSession):
    """Verify product creation duplicate barcode, category validation, and 404 router paths."""
    home_id = uuid.uuid4()

    p = await ProductService.create_product(
        db_session,
        ProductCreate(name="Olive Oil", barcode="888877776666", base_unit=BaseUnit.ML),
        home_id,
    )
    assert p.id is not None

    # Duplicate barcode
    with pytest.raises(ValueError, match="already exists"):
        await ProductService.create_product(
            db_session,
            ProductCreate(name="Olive Oil Extra", barcode="888877776666", base_unit=BaseUnit.ML),
            home_id,
        )

    # Invalid category ID
    with pytest.raises(ValueError, match="Category with ID .* not found"):
        await ProductService.create_product(
            db_session,
            ProductCreate(name="Invalid Cat Product", category_id=uuid.uuid4(), base_unit=BaseUnit.PIECE),
            home_id,
        )

    # Missing product
    assert await ProductService.get_product(db_session, uuid.uuid4(), home_id) is None
    assert await ProductService.update_product(db_session, uuid.uuid4(), home_id, ProductUpdate(name="Test")) is None
    assert await ProductService.delete_product(db_session, uuid.uuid4(), home_id) is False

    # Router 404s
    random_id = uuid.uuid4()
    res = await client.get(f"/api/v1/products/{random_id}")
    assert res.status_code == 404
    res = await client.patch(f"/api/v1/products/{random_id}", json={"name": "New Product"})
    assert res.status_code == 404
    res = await client.delete(f"/api/v1/products/{random_id}")
    assert res.status_code == 404


async def test_inventory_service_reconciliation_and_delegations(db_session: AsyncSession):
    """Verify inventory reconciliation transactions and delegation methods."""
    home_id = uuid.uuid4()

    product = Product(name="Salt", base_unit=BaseUnit.G, home_id=home_id, is_global=False)
    location = Location(name="Pantry Shelf", home_id=home_id, is_system=False)
    db_session.add(product)
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(product)
    await db_session.refresh(location)

    # Reconciliation transaction sets absolute stock level
    ledger = await InventoryService.create_transaction(
        db_session,
        InventoryTransactionCreate(
            product_id=product.id,
            location_id=location.id,
            transaction_type=InventoryTransactionType.RECONCILIATION,
            quantity_input=250.0,
            unit_input="g",
        ),
        home_id,
    )
    assert ledger.quantity == 250.0

    # Delegated methods
    history = await InventoryService.get_ledger_history(db_session, home_id, product_id=product.id)
    assert len(history) >= 1

    low_stock = await InventoryService.get_low_stock_items(db_session, home_id)
    assert isinstance(low_stock, list)

    exp_summary = await InventoryService.get_expiration_summary(db_session, home_id)
    assert isinstance(exp_summary, dict)


async def test_category_and_location_service_edge_cases(db_session: AsyncSession):
    """Verify category/location service delete paths and integrity errors."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    # Category success deletion & update name clash
    cat1 = await CategoryService.create_category(db_session, CategoryCreate(name="Cat One"), owner_id, home_id)
    cat2 = await CategoryService.create_category(db_session, CategoryCreate(name="Cat Two"), owner_id, home_id)

    # Renaming cat2 to cat1 name raises ValueError
    with pytest.raises(ValueError, match="already exists"):
        await CategoryService.update_category(db_session, cat2.id, home_id, CategoryUpdate(name="Cat One"))

    # Update category success
    updated = await CategoryService.update_category(db_session, cat2.id, home_id, CategoryUpdate(name="Cat Two New"))
    assert updated is not None
    assert updated.name == "Cat Two New"

    # Delete category success
    assert await CategoryService.delete_category(db_session, cat1.id, home_id) is True

    # Category IntegrityErrors
    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(ValueError, match="already exists"):
            await CategoryService.create_category(db_session, CategoryCreate(name="Fail Cat"), owner_id, home_id)
        with pytest.raises(ValueError, match="Category name conflict"):
            await CategoryService.update_category(db_session, cat2.id, home_id, CategoryUpdate(description="fail"))

    # Location success deletion with Backlog fallback
    backlog = Location(name="Backlog", home_id=home_id, is_system=True)
    loc = await LocationService.create_location(db_session, LocationCreate(name="Old Loc"), owner_id, home_id)
    db_session.add(backlog)
    await db_session.commit()
    await db_session.refresh(loc)

    loc_id = loc.id
    # Update location success
    updated_loc = await LocationService.update_location(db_session, loc_id, home_id, LocationUpdate(name="Loc Updated"))
    assert updated_loc is not None
    assert updated_loc.name == "Loc Updated"

    # Delete location success
    assert await LocationService.delete_location(db_session, loc_id, home_id) is True

    # Location IntegrityErrors
    loc3 = await LocationService.create_location(db_session, LocationCreate(name="Loc 3"), owner_id, home_id)
    loc3_id = loc3.id

    with (
        patch.object(db_session, "commit", AsyncMock(side_effect=IntegrityError("stmt", "params", Exception("orig")))),
        patch.object(db_session, "rollback", AsyncMock()),
    ):
        with pytest.raises(ValueError, match="Failed to create location"):
            await LocationService.create_location(db_session, LocationCreate(name="Fail Loc"), owner_id, home_id)
        with pytest.raises(ValueError, match="Failed to update location"):
            await LocationService.update_location(db_session, loc3_id, home_id, LocationUpdate(name="Fail Update"))


async def test_product_service_updates_and_deletion(db_session: AsyncSession):
    """Verify product updates with nutrition details and deletion."""
    from src.features.products.schemas import ProductNutritionCreate

    home_id = uuid.uuid4()
    p = await ProductService.create_product(
        db_session,
        ProductCreate(
            name="Cereal",
            base_unit=BaseUnit.G,
            nutrition=ProductNutritionCreate(calories=350.0, fat=5.0, carbohydrates=70.0, protein=8.0),
        ),
        home_id,
    )
    p_id = p.id

    # Update product with individual nutrition changes
    updated_p = await ProductService.update_product(
        db_session,
        p_id,
        home_id,
        ProductUpdate(name="Cereal Crunchy"),
    )
    assert updated_p is not None
    assert updated_p.name == "Cereal Crunchy"

    # Delete product success
    assert await ProductService.delete_product(db_session, p_id, home_id) is True
