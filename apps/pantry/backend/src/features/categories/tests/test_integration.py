import uuid
import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID

@pytest.fixture(autouse=True)
async def seed_categories(db_session: AsyncSession):
    """Seed default categories dynamically for categories tests."""
    from src.features.categories.seeder import seed_default_categories
    await seed_default_categories(db_session)
    await db_session.commit()

async def test_startup_seeds_categories(client: AsyncClient):
    """Verify that the default global categories are seeded on startup."""
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 6
    names = {cat["name"] for cat in data}
    expected_names = {"Drinks", "Batteries", "Spices", "Grains", "Canned Goods", "Snacks"}
    assert names == expected_names
    for cat in data:
        assert cat["is_global"] is True
        assert cat["home_id"] is None

async def test_create_personal_category(client: AsyncClient):
    """Verify that a new personal category can be created successfully."""
    payload = {"name": "Fresh Veggies", "description": "Vegetables in the crisper drawer"}
    response = await client.post("/api/v1/categories", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Fresh Veggies"
    assert data["description"] == "Vegetables in the crisper drawer"
    assert data["is_global"] is False
    assert data["home_id"] == str(MOCK_HOME_ID)
    assert "id" in data

async def test_create_personal_category_clash_global(client: AsyncClient):
    """Verify we cannot create a personal category with the same name as a global one."""
    payload = {"name": "Drinks", "description": "Custom drinks category"}
    response = await client.post("/api/v1/categories", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

async def test_create_personal_category_clash_personal(client: AsyncClient):
    """Verify we cannot create duplicate personal categories in the same home space."""
    payload = {"name": "Baking Goods"}
    res1 = await client.post("/api/v1/categories", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/categories", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

async def test_list_and_filter_categories(client: AsyncClient):
    """Verify listing and filtering active categories."""
    await client.post("/api/v1/categories", json={"name": "Baking"})

    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7

    response = await client.get("/api/v1/categories?name=Baking")
    assert response.status_code == 200
    filtered = response.json()
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Baking"

async def test_get_category_by_id(client: AsyncClient):
    """Verify getting details of a specific category by ID."""
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    get_res = await client.get(f"/api/v1/categories/{global_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == global_id

    create_res = await client.post("/api/v1/categories", json={"name": "Condiments"})
    personal_id = create_res.json()["id"]

    get_personal = await client.get(f"/api/v1/categories/{personal_id}")
    assert get_personal.status_code == 200
    assert get_personal.json()["name"] == "Condiments"

    fake_id = uuid.uuid4()
    response = await client.get(f"/api/v1/categories/{fake_id}")
    assert response.status_code == 404

async def test_update_personal_category(client: AsyncClient):
    """Verify updating fields of a personal category."""
    create_res = await client.post("/api/v1/categories", json={"name": "Pasta", "description": "Dry pasta"})
    cat_id = create_res.json()["id"]

    patch_res = await client.patch(f"/api/v1/categories/{cat_id}", json={"name": "Pasta & Grains", "description": "Updated"})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Pasta & Grains"
    assert data["description"] == "Updated"

async def test_update_global_category_blocked(client: AsyncClient):
    """Verify that global categories cannot be modified."""
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    patch_res = await client.patch(f"/api/v1/categories/{global_id}", json={"name": "New Global Name"})
    assert patch_res.status_code == 400
    assert "Global categories cannot be modified" in patch_res.json()["detail"]

async def test_delete_personal_category(client: AsyncClient):
    """Verify deleting a personal category."""
    create_res = await client.post("/api/v1/categories", json={"name": "Sauces"})
    cat_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/categories/{cat_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/v1/categories/{cat_id}")
    assert get_res.status_code == 404

async def test_delete_global_category_blocked(client: AsyncClient):
    """Verify that global categories cannot be deleted."""
    list_res = await client.get("/api/v1/categories")
    global_id = list_res.json()[0]["id"]

    del_res = await client.delete(f"/api/v1/categories/{global_id}")
    assert del_res.status_code == 400
    assert "Global categories cannot be deleted" in del_res.json()["detail"]
