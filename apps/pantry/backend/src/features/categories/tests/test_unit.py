import uuid
import pytest
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.categories.models import Category, CategoryCreate, CategoryUpdate
from src.features.categories.service import CategoryService

def test_category_model_defaults():
    """Verify that Category model attributes construct with correct defaults."""
    cat = Category(name="Dry Spices")
    assert cat.name == "Dry Spices"
    assert cat.is_global is False
    assert cat.description is None
    assert cat.home_id is None
    assert cat.owner_id is None

async def test_create_category_name_clash(db_session: AsyncSession):
    """Verify raising ValueError when CategoryService tries to create a category with duplicate name."""
    owner_id = uuid.uuid4()
    home_id = uuid.uuid4()

    # Create first category
    await CategoryService.create_category(
        session=db_session,
        payload=CategoryCreate(name="Baking"),
        owner_id=owner_id,
        home_id=home_id,
    )

    # Attempt duplicate
    with pytest.raises(ValueError) as exc:
        await CategoryService.create_category(
            session=db_session,
            payload=CategoryCreate(name="Baking"),
            owner_id=owner_id,
            home_id=home_id,
        )
    assert "already exists" in str(exc.value)

async def test_get_category_missing(db_session: AsyncSession):
    """Verify CategoryService returns None for non-existent category."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await CategoryService.get_category(db_session, fake_id, home_id)
    assert res is None

async def test_update_category_missing(db_session: AsyncSession):
    """Verify CategoryService returns None when updating non-existent category."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await CategoryService.update_category(
        db_session, fake_id, home_id, CategoryUpdate(name="Missing")
    )
    assert res is None

async def test_update_category_global_blocked(db_session: AsyncSession):
    """Verify CategoryService blocks updating global categories."""
    home_id = uuid.uuid4()
    # Create global category
    global_cat = Category(name="Global Drinks", is_global=True)
    db_session.add(global_cat)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await CategoryService.update_category(
            db_session, global_cat.id, home_id, CategoryUpdate(name="Modified Drinks")
        )
    assert "Global categories cannot be modified" in str(exc.value)

async def test_update_category_name_clash(db_session: AsyncSession):
    """Verify CategoryService blocks renaming a category to another existing category name."""
    owner_id = uuid.uuid4()
    home_id = uuid.uuid4()

    await CategoryService.create_category(
        db_session, CategoryCreate(name="Fruits"), owner_id, home_id
    )
    cat2 = await CategoryService.create_category(
        db_session, CategoryCreate(name="Veggies"), owner_id, home_id
    )

    with pytest.raises(ValueError) as exc:
        await CategoryService.update_category(
            db_session, cat2.id, home_id, CategoryUpdate(name="Fruits")
        )
    assert "already exists" in str(exc.value)

async def test_delete_category_missing(db_session: AsyncSession):
    """Verify CategoryService returns False when deleting non-existent category."""
    home_id = uuid.uuid4()
    fake_id = uuid.uuid4()
    res = await CategoryService.delete_category(db_session, fake_id, home_id)
    assert res is False

async def test_delete_category_global_blocked(db_session: AsyncSession):
    """Verify CategoryService blocks deleting global categories."""
    home_id = uuid.uuid4()
    global_cat = Category(name="Global Spice", is_global=True)
    db_session.add(global_cat)
    await db_session.commit()

    with pytest.raises(ValueError) as exc:
        await CategoryService.delete_category(db_session, global_cat.id, home_id)
    assert "Global categories cannot be deleted" in str(exc.value)
