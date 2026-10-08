import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.inventory.models import InventoryLedger
from src.features.locations.models import Location
from src.features.locations.seeder import seed_default_locations

NOW = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
async def seed_locations(db_session: AsyncSession):
    """Seed the Backlog system location."""
    await seed_default_locations(db_session)
    await db_session.commit()


async def _record(client: AsyncClient, product_id: str, location_id: str, kind: str, quantity: float) -> dict:
    response = await client.post(
        "/api/v1/inventory/transactions",
        json={
            "product_id": product_id,
            "location_id": location_id,
            "transaction_type": kind,
            "quantity_input": quantity,
            "unit_input": "g",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def ledger(client: AsyncClient, db_session: AsyncSession) -> list[dict]:
    """Five ledger entries (IN, OUT, WASTE, OUT, IN) created 5, 4, 3, 2 and 1 days before NOW, oldest first."""
    backlog = str((await db_session.exec(select(Location).where(Location.is_system))).one().id)
    product = (await client.post("/api/v1/products", json={"name": "Rice", "base_unit": "g"})).json()
    other = (await client.post("/api/v1/products", json={"name": "Beans", "base_unit": "g"})).json()

    entries = [
        await _record(client, product["id"], backlog, "in", 100),
        await _record(client, product["id"], backlog, "out", 10),
        await _record(client, product["id"], backlog, "waste", 5),
        await _record(client, product["id"], backlog, "out", 20),
        await _record(client, other["id"], backlog, "in", 50),
    ]
    for day, entry in enumerate(entries):
        row = (await db_session.exec(select(InventoryLedger).where(InventoryLedger.id == uuid.UUID(entry["id"])))).one()
        row.created_at = NOW - timedelta(days=len(entries) - day)
        db_session.add(row)
    await db_session.commit()
    return entries


async def _ids(client: AsyncClient, **params) -> list[str]:
    response = await client.get("/api/v1/inventory/transactions", params=params)
    assert response.status_code == 200
    return [entry["id"] for entry in response.json()]


async def test_ledger_is_newest_first_and_pages_without_gaps(client: AsyncClient, ledger: list[dict]):
    """Offset paging walks the whole history newest first, with no entry lost or repeated."""
    expected = [entry["id"] for entry in reversed(ledger)]

    first = await _ids(client, limit=2, offset=0)
    second = await _ids(client, limit=2, offset=2)
    third = await _ids(client, limit=2, offset=4)

    assert first + second + third == expected
    assert await _ids(client, limit=2, offset=6) == []


async def test_ledger_filters_by_transaction_type(client: AsyncClient, ledger: list[dict]):
    """The repeatable transaction_type filter keeps only the requested movement kinds."""
    consumption = await _ids(client, transaction_type=["out", "waste"])
    assert set(consumption) == {ledger[1]["id"], ledger[2]["id"], ledger[3]["id"]}

    only_in = await _ids(client, transaction_type="in")
    assert set(only_in) == {ledger[0]["id"], ledger[4]["id"]}


async def test_ledger_date_range_is_inclusive_from_and_exclusive_to(client: AsyncClient, ledger: list[dict]):
    """date_from is inclusive and date_to exclusive, so adjacent windows never overlap."""
    boundary = (NOW - timedelta(days=3)).isoformat()  # created_at of ledger[2]

    newer = await _ids(client, date_from=boundary)
    older = await _ids(client, date_to=boundary)

    assert set(newer) == {ledger[2]["id"], ledger[3]["id"], ledger[4]["id"]}
    assert set(older) == {ledger[0]["id"], ledger[1]["id"]}
    assert set(newer).isdisjoint(older)


async def test_ledger_date_range_honours_time_zone_offsets(client: AsyncClient, ledger: list[dict]):
    """An offset-aware date_from is converted to UTC before it is compared with the stored timestamps."""
    # ledger[3] sits at 2026-06-13T12:00Z, which is 14:00 at +02:00; ledger[2] is a day earlier.
    window_start = "2026-06-13T14:00:00+02:00"
    assert set(await _ids(client, date_from=window_start)) == {ledger[3]["id"], ledger[4]["id"]}


async def test_ledger_combines_product_type_and_date_filters(client: AsyncClient, ledger: list[dict]):
    """All filters apply together, so the consumption chart can request exactly one window."""
    rice = (await client.get("/api/v1/products", params={"name": "Rice"})).json()[0]["id"]
    ids = await _ids(
        client,
        product_id=rice,
        transaction_type=["out", "waste"],
        date_from=(NOW - timedelta(days=4)).isoformat(),
        date_to=(NOW - timedelta(days=1)).isoformat(),
    )
    assert set(ids) == {ledger[1]["id"], ledger[2]["id"], ledger[3]["id"]}


async def test_ledger_rejects_an_unknown_transaction_type(client: AsyncClient):
    response = await client.get("/api/v1/inventory/transactions", params={"transaction_type": "teleport"})
    assert response.status_code == 422
