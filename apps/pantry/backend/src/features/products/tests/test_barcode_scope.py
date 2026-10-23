import uuid
from unittest.mock import AsyncMock, patch

import pytest
from backend_shared.household.testing import DEFAULT_TEST_SUB, StaticMembershipLookup
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import MOCK_HOME_ID
from src.features.locations.models import Location
from src.features.products.services.product_crud_service import ProductCrudService

BARCODE = "4012345678901"


@pytest.fixture
def two_homes(membership: StaticMembershipLookup, auth_headers):
    home_a, home_b = uuid.uuid4(), uuid.uuid4()
    membership.set(home_a, DEFAULT_TEST_SUB, "MEMBER")
    membership.set(home_b, DEFAULT_TEST_SUB, "MEMBER")
    return auth_headers(household_id=home_a), auth_headers(household_id=home_b)


async def test_barcoded_product_stays_household_local(client: AsyncClient, two_homes):
    """A barcode never promotes a user product into the shared catalog."""
    headers_a, headers_b = two_homes
    res = await client.post(
        "/api/v1/products",
        json={"name": "A Jam", "barcode": BARCODE, "base_unit": "g", "minimum_stock": 5},
        headers=headers_a,
    )
    assert res.status_code == 201
    product = res.json()
    assert product["is_global"] is False
    assert product["home_id"] is not None

    listed_b = await client.get("/api/v1/products", headers=headers_b)
    assert product["id"] not in {p["id"] for p in listed_b.json()}
    assert (await client.get(f"/api/v1/products/{product['id']}", headers=headers_b)).status_code == 404

    with patch("src.features.products.router.off_client.get_by_barcode", new=AsyncMock(return_value=None)):
        lookup_b = await client.get(f"/api/v1/products/barcode/{BARCODE}", headers=headers_b)
        lookup_a = await client.get(f"/api/v1/products/barcode/{BARCODE}", headers=headers_a)
    assert lookup_b.status_code == 404
    assert lookup_a.status_code == 200
    assert lookup_a.json()["id"] == product["id"]


async def test_same_barcode_allowed_in_other_household_but_not_twice_in_one(client: AsyncClient, two_homes):
    headers_a, headers_b = two_homes
    payload = {"name": "Shared Code", "barcode": BARCODE, "base_unit": "g"}
    assert (await client.post("/api/v1/products", json=payload, headers=headers_a)).status_code == 201
    assert (await client.post("/api/v1/products", json=payload, headers=headers_b)).status_code == 201
    dup = await client.post("/api/v1/products", json=payload, headers=headers_a)
    assert dup.status_code == 400
    assert "already exists" in dup.json()["detail"]


async def test_low_stock_ignores_other_households_products(client: AsyncClient, two_homes):
    headers_a, headers_b = two_homes
    res = await client.post(
        "/api/v1/products",
        json={"name": "A Low", "barcode": BARCODE, "base_unit": "g", "minimum_stock": 50},
        headers=headers_a,
    )
    pid = res.json()["id"]
    low_a = await client.get("/api/v1/inventory/low-stock", headers=headers_a)
    low_b = await client.get("/api/v1/inventory/low-stock", headers=headers_b)
    assert pid in {i["product"]["id"] for i in low_a.json()}
    assert pid not in {i["product"]["id"] for i in low_b.json()}


async def test_owner_can_edit_and_delete_barcoded_product(client: AsyncClient, two_homes):
    headers_a, _ = two_homes
    res = await client.post("/api/v1/products", json={"name": "Editable", "base_unit": "g"}, headers=headers_a)
    pid = res.json()["id"]
    patched = await client.patch(f"/api/v1/products/{pid}", json={"barcode": BARCODE}, headers=headers_a)
    assert patched.status_code == 200
    assert patched.json()["is_global"] is False
    assert patched.json()["barcode"] == BARCODE
    renamed = await client.patch(f"/api/v1/products/{pid}", json={"name": "Renamed"}, headers=headers_a)
    assert renamed.status_code == 200
    assert (await client.delete(f"/api/v1/products/{pid}", headers=headers_a)).status_code == 204


@pytest.mark.parametrize("path", ["products", "categories", "locations"])
async def test_pagination_bounds_rejected(client: AsyncClient, path: str):
    assert (await client.get(f"/api/v1/{path}?limit=100000")).status_code == 422
    assert (await client.get(f"/api/v1/{path}?limit=0")).status_code == 422
    assert (await client.get(f"/api/v1/{path}?offset=-1")).status_code == 422
    assert (await client.get(f"/api/v1/{path}?limit=100&offset=0")).status_code == 200


async def test_transaction_rejects_other_households_system_location(client: AsyncClient, db_session: AsyncSession):
    foreign = Location(name="Backlog", is_system=True, owner_id=uuid.uuid4(), home_id=uuid.uuid4())
    db_session.add(foreign)
    await db_session.commit()
    prod = await client.post("/api/v1/products", json={"name": "Flour", "base_unit": "g"})
    res = await client.post(
        "/api/v1/inventory/transactions",
        json={
            "product_id": prod.json()["id"],
            "location_id": str(foreign.id),
            "transaction_type": "in",
            "quantity_input": 1,
            "unit_input": "g",
        },
    )
    assert res.status_code >= 400


async def test_integrity_error_details_are_not_exposed(db_session: AsyncSession):
    boom = IntegrityError("INSERT secret_table", {}, Exception("duplicate key secret_constraint"))
    with patch.object(db_session, "commit", new=AsyncMock(side_effect=boom)):
        with pytest.raises(ValueError) as exc:
            await ProductCrudService.create_product(db_session, MOCK_HOME_ID, name="X", base_unit="g")
    assert "secret" not in str(exc.value)
