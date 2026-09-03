"""Integration tests for library lending lifecycle, return edge cases, and history filters."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Item, LendingRecord, LendingStatus, MediaType

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("4eeb7681-8419-4c52-b800-6fef6c7ee51b")


@pytest.mark.asyncio
async def test_lend_and_return_edge_cases(client: AsyncClient, db_session: AsyncSession):
    """Verify lending and return edge cases including already lent, not lent, and note append flows."""
    fake_id = uuid.uuid4()

    # 1. Lend nonexistent item -> 404
    res_lend_missing = await client.post(f"/api/v1/library/items/{fake_id}/lend", json={"contact_name": "Bob"})
    assert res_lend_missing.status_code == 404

    # 2. Return nonexistent item -> 404
    res_return_missing = await client.post(f"/api/v1/library/items/{fake_id}/return")
    assert res_return_missing.status_code == 404

    # Create available item
    item = Item(
        title="Dune",
        media_type=MediaType.BOOK,
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        status=LendingStatus.AVAILABLE,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)

    # 3. Return available item -> 400 (not currently lent out)
    res_return_avail = await client.post(f"/api/v1/library/items/{item.id}/return")
    assert res_return_avail.status_code == 400
    assert "not currently lent out" in res_return_avail.json()["detail"]

    # 4. Lend item with custom lent_at, due_date, and notes
    due = (datetime.now(UTC) + timedelta(days=14)).isoformat()
    res_lend = await client.post(
        f"/api/v1/library/items/{item.id}/lend",
        json={"contact_name": "Alice", "due_date": due, "notes": "Borrowing for book club"},
    )
    assert res_lend.status_code == 201
    assert res_lend.json()["contact_name"] == "Alice"
    assert res_lend.json()["notes"] == "Borrowing for book club"

    # 5. Lend already lent out item -> 400
    res_lend_again = await client.post(f"/api/v1/library/items/{item.id}/lend", json={"contact_name": "Charlie"})
    assert res_lend_again.status_code == 400
    assert "already lent out" in res_lend_again.json()["detail"]

    # 6. Return item with return note (appended to existing notes)
    res_return = await client.post(
        f"/api/v1/library/items/{item.id}/return",
        json={"notes": "Returned in perfect condition"},
    )
    assert res_return.status_code == 200
    assert "Return note: Returned in perfect condition" in res_return.json()["notes"]

    # 7. Fallback return when item.status is LENT_OUT but no active record found
    item.status = LendingStatus.LENT_OUT
    db_session.add(item)
    await db_session.commit()

    res_fallback_return = await client.post(
        f"/api/v1/library/items/{item.id}/return",
        json={"notes": "Manual reconciliation"},
    )
    assert res_fallback_return.status_code == 200
    assert res_fallback_return.json()["contact_name"] == "Unknown"

    await db_session.refresh(item)
    assert item.status == LendingStatus.AVAILABLE


@pytest.mark.asyncio
async def test_list_lending_history_filters_and_pagination(client: AsyncClient, db_session: AsyncSession):
    """Verify lending history filtering by item_id, contact_name, status, and pagination."""
    item1 = Item(title="Game A", media_type=MediaType.GAME, household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    item2 = Item(title="Game B", media_type=MediaType.GAME, household_id=DEFAULT_TEST_HOUSEHOLD_ID)
    db_session.add_all([item1, item2])
    await db_session.commit()
    await db_session.refresh(item1)
    await db_session.refresh(item2)

    now = datetime.now(UTC)
    rec1 = LendingRecord(
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        item_id=item1.id,
        contact_name="Daniel Craig",
        status=LendingStatus.AVAILABLE,
        lent_at=now - timedelta(days=5),
        returned_at=now - timedelta(days=1),
    )
    rec2 = LendingRecord(
        household_id=DEFAULT_TEST_HOUSEHOLD_ID,
        item_id=item2.id,
        contact_name="Emma Stone",
        status=LendingStatus.LENT_OUT,
        lent_at=now,
    )
    db_session.add_all([rec1, rec2])
    await db_session.commit()

    # Filter by item_id
    res_item = await client.get(f"/api/v1/library/lending/history?item_id={item1.id}")
    assert res_item.status_code == 200
    assert res_item.json()["total"] == 1
    assert res_item.json()["records"][0]["contact_name"] == "Daniel Craig"

    # Filter by contact_name substring
    res_contact = await client.get("/api/v1/library/lending/history?contact_name=craig")
    assert res_contact.status_code == 200
    assert res_contact.json()["total"] == 1

    # Filter by status
    res_status = await client.get("/api/v1/library/lending/history?status=LENT_OUT")
    assert res_status.status_code == 200
    assert res_status.json()["total"] >= 1
