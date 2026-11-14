"""Shopping keeps working when the optional Pantry app is absent or down (#864)."""

import uuid

import httpx
import pytest
from httpx import AsyncClient
from src.core.config import settings
from src.core.exceptions import PantryNotInstalledError, PantryServiceError
from src.features.capabilities.service import get_capabilities
from src.features.shopping_lists.clients.pantry_client import PantryClient


@pytest.fixture
def pantry_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run the test as an installation without Pantry (empty PANTRY_BACKEND_URL)."""
    monkeypatch.setattr(settings, "PANTRY_BACKEND_URL", "")


@pytest.mark.asyncio
async def test_capabilities_report_pantry_available(client: AsyncClient):
    response = await client.get("/api/v1/shopping/capabilities")
    assert response.status_code == 200
    assert response.json() == {"pantry_available": True}


@pytest.mark.asyncio
async def test_capabilities_report_pantry_absent(client: AsyncClient, pantry_absent: None):
    response = await client.get("/api/v1/shopping/capabilities")
    assert response.status_code == 200
    assert response.json() == {"pantry_available": False}


@pytest.mark.asyncio
async def test_capabilities_require_authentication(client: AsyncClient):
    response = await client.get("/api/v1/shopping/capabilities", headers={"Authorization": ""})
    assert response.status_code == 401


def test_whitespace_pantry_url_counts_as_absent(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "PANTRY_BACKEND_URL", "   ")
    assert get_capabilities(settings).pantry_available is False


@pytest.mark.asyncio
async def test_list_crud_works_without_pantry(client: AsyncClient, pantry_absent: None):
    created = await client.post("/api/v1/shopping-lists", json={"name": "Weekend"})
    assert created.status_code in (200, 201), created.text
    list_id = created.json()["id"]

    item = await client.post(
        f"/api/v1/shopping-lists/{list_id}/items",
        json={"name": "Bread", "quantity": 1, "unit": "piece"},
    )
    assert item.status_code in (200, 201), item.text
    item_id = item.json()["id"]

    updated = await client.patch(f"/api/v1/shopping-lists/{list_id}/items/{item_id}", json={"is_completed": True})
    assert updated.status_code == 200, updated.text

    fetched = await client.get(f"/api/v1/shopping-lists/{list_id}")
    assert fetched.status_code == 200
    assert [i["name"] for i in fetched.json()["items"]] == ["Bread"]

    deleted = await client.delete(f"/api/v1/shopping-lists/{list_id}/items/{item_id}")
    assert deleted.status_code in (200, 204)


@pytest.mark.asyncio
async def test_pantry_calls_answer_503_without_pantry(client: AsyncClient, pantry_absent: None):
    created = await client.post("/api/v1/shopping-lists", json={"name": "Groceries"})
    list_id = created.json()["id"]

    for path in ("auto-import-low-stock", "sync-to-pantry"):
        if path == "sync-to-pantry":
            item = await client.post(
                f"/api/v1/shopping-lists/{list_id}/items",
                json={"name": "Milk", "quantity": 1, "unit": "l"},
            )
            await client.patch(
                f"/api/v1/shopping-lists/{list_id}/items/{item.json()['id']}", json={"is_completed": True}
            )
        response = await client.post(f"/api/v1/shopping-lists/{list_id}/{path}")
        assert response.status_code == 503, (path, response.text)
        assert response.json()["detail"]["error_code"] == "shopping.error.pantry_not_installed"


@pytest.mark.asyncio
async def test_pantry_client_refuses_without_url(pantry_absent: None):
    client = PantryClient()
    with pytest.raises(PantryNotInstalledError):
        await client.fetch_low_stock_items(token=None, household_id=uuid.uuid4())
    with pytest.raises(PantryNotInstalledError):
        await client.bulk_add_items(items=[], token=None, household_id=uuid.uuid4())


@pytest.mark.asyncio
async def test_pantry_unreachable_answers_502(client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    async def refuse(self: PantryClient, token: str | None, household_id: uuid.UUID) -> list[dict]:
        raise PantryServiceError(f"Pantry service network request failed: {httpx.ConnectError('refused')}")

    monkeypatch.setattr(PantryClient, "fetch_low_stock_items", refuse)
    created = await client.post("/api/v1/shopping-lists", json={"name": "Stock"})
    response = await client.post(f"/api/v1/shopping-lists/{created.json()['id']}/auto-import-low-stock")
    assert response.status_code == 502
    assert response.json()["detail"]["error_code"] == "shopping.error.pantry_service_unavailable"
