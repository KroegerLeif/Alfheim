import uuid

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID
from src.core.errors import ResourceInUseError
from src.features.categories.service import CategoryService
from src.features.locations.seeder import seed_default_locations


@pytest.fixture(autouse=True)
async def seed_locations(db_session: AsyncSession):
    """Seed the system location so the shared fixtures behave like a fresh household."""
    await seed_default_locations(db_session)
    await db_session.commit()


async def _create_category(client: AsyncClient, name: str) -> str:
    response = await client.post("/api/v1/categories", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


async def test_delete_category_in_use_returns_409_with_count(client: AsyncClient):
    """Deleting a category that products reference is a clean 409 with a stable code and the count."""
    category_id = await _create_category(client, "Baking")
    for name in ("Flour", "Sugar"):
        created = await client.post(
            "/api/v1/products", json={"name": name, "base_unit": "g", "category_id": category_id}
        )
        assert created.status_code == 201

    response = await client.delete(f"/api/v1/categories/{category_id}")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "category_in_use"
    assert detail["item_count"] == 2
    assert "Baking" in detail["message"]
    # The category survives the refused delete.
    assert (await client.get(f"/api/v1/categories/{category_id}")).status_code == 200


async def test_delete_category_succeeds_after_products_are_unassigned(client: AsyncClient):
    """Once no product references the category any more, the delete goes through."""
    category_id = await _create_category(client, "Baking")
    product = (
        await client.post("/api/v1/products", json={"name": "Flour", "base_unit": "g", "category_id": category_id})
    ).json()

    assert (await client.delete(f"/api/v1/categories/{category_id}")).status_code == 409

    assert (await client.delete(f"/api/v1/products/{product['id']}")).status_code == 204
    assert (await client.delete(f"/api/v1/categories/{category_id}")).status_code == 204
    assert (await client.get(f"/api/v1/categories/{category_id}")).status_code == 404


async def test_delete_category_in_use_raises_resource_in_use_error(client: AsyncClient, db_session: AsyncSession):
    """The service raises the structured error that the REST handler and the MCP tools both consume."""
    category_id = await _create_category(client, "Baking")
    await client.post("/api/v1/products", json={"name": "Flour", "base_unit": "g", "category_id": category_id})

    with pytest.raises(ResourceInUseError) as exc:
        await CategoryService.delete_category(db_session, uuid.UUID(category_id), MOCK_HOME_ID)

    assert exc.value.code == "category_in_use"
    assert exc.value.item_count == 1
    assert exc.value.to_detail() == {
        "code": "category_in_use",
        "message": exc.value.message,
        "item_count": 1,
    }
