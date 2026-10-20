"""Cross-household reference checks, amount validation and slash-less collection routes."""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from tests.helpers import create_auth_headers


async def _seed_household(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    """Create an account, pot, plan and category for the household and return their ids."""
    account = await client.post(
        "/api/v1/accounts", headers=headers, json={"name": "Main", "account_type": "CHECKING", "balance": "1000.00"}
    )
    pot = await client.post(
        "/api/v1/pots", headers=headers, json={"name": "Vacation", "priority": 1, "current_amount": "500.00"}
    )
    plan = await client.post(
        "/api/v1/plans", headers=headers, json={"name": "Renovation", "plan_type": "EVENT", "total_budget": "100.00"}
    )
    plan_id = plan.json()["id"]
    category = await client.post(
        f"/api/v1/plans/{plan_id}/categories", headers=headers, json={"name": "Paint", "allocated_amount": "50.00"}
    )
    for resp in (account, pot, plan, category):
        assert resp.status_code == 201
    return {
        "account_id": account.json()["id"],
        "pot_id": pot.json()["id"],
        "plan_id": plan_id,
        "category_id": category.json()["id"],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("ref", ["account_id", "pot_id", "plan_id", "category_id"])
async def test_create_rejects_foreign_reference_without_touching_balances(client: AsyncClient, ref: str):
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()
    ids_b = await _seed_household(client, headers_b)

    payload = {"description": "Attack", "amount": "100.00", "transaction_type": "EXPENSE", ref: ids_b[ref]}
    for path in ("/api/v1/transactions", "/api/v1/transactions/quick-add"):
        resp = await client.post(path, headers=headers_a, json=payload)
        assert resp.status_code == 404

    account = await client.get(f"/api/v1/accounts/{ids_b['account_id']}", headers=headers_b)
    pot = await client.get(f"/api/v1/pots/{ids_b['pot_id']}", headers=headers_b)
    assert Decimal(account.json()["balance"]) == Decimal("1000.00")
    assert Decimal(pot.json()["current_amount"]) == Decimal("500.00")
    assert (await client.get("/api/v1/transactions", headers=headers_a)).json() == []


@pytest.mark.asyncio
async def test_foreign_and_missing_reference_are_indistinguishable(client: AsyncClient):
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()
    ids_b = await _seed_household(client, headers_b)
    payload = {"description": "x", "amount": "1.00"}

    foreign = await client.post("/api/v1/transactions", headers=headers_a, json={**payload, "pot_id": ids_b["pot_id"]})
    missing = await client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={**payload, "pot_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()


@pytest.mark.asyncio
@pytest.mark.parametrize("ref", ["account_id", "pot_id", "plan_id", "category_id"])
async def test_update_rejects_foreign_reference(client: AsyncClient, ref: str):
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()
    ids_b = await _seed_household(client, headers_b)
    created = await client.post(
        "/api/v1/transactions", headers=headers_a, json={"description": "Own", "amount": "10.00"}
    )
    assert created.status_code == 201

    resp = await client.patch(f"/api/v1/transactions/{created.json()['id']}", headers=headers_a, json={ref: ids_b[ref]})
    assert resp.status_code == 404

    account = await client.get(f"/api/v1/accounts/{ids_b['account_id']}", headers=headers_b)
    pot = await client.get(f"/api/v1/pots/{ids_b['pot_id']}", headers=headers_b)
    assert Decimal(account.json()["balance"]) == Decimal("1000.00")
    assert Decimal(pot.json()["current_amount"]) == Decimal("500.00")


@pytest.mark.asyncio
async def test_own_references_still_work_and_foreign_transactions_do_not_block_delete(client: AsyncClient):
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()
    ids_a = await _seed_household(client, headers_a)
    ids_b = await _seed_household(client, headers_b)

    resp = await client.post(
        "/api/v1/transactions", headers=headers_a, json={"description": "Own", "amount": "25.00", **ids_a}
    )
    assert resp.status_code == 201
    account = await client.get(f"/api/v1/accounts/{ids_a['account_id']}", headers=headers_a)
    assert Decimal(account.json()["balance"]) == Decimal("975.00")

    # A's transaction references only A's rows, so B's account and pot stay deletable.
    assert (await client.delete(f"/api/v1/accounts/{ids_b['account_id']}", headers=headers_b)).status_code == 204
    assert (await client.delete(f"/api/v1/pots/{ids_b['pot_id']}", headers=headers_b)).status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize("amount", ["0", "0.00", "-5.00"])
async def test_non_positive_amount_rejected(client: AsyncClient, amount: str):
    headers = create_auth_headers()
    for path in ("/api/v1/transactions", "/api/v1/transactions/quick-add"):
        resp = await client.post(path, headers=headers, json={"description": "Bad", "amount": amount})
        assert resp.status_code == 422
    created = await client.post("/api/v1/transactions", headers=headers, json={"description": "Ok", "amount": "5.00"})
    resp = await client.patch(f"/api/v1/transactions/{created.json()['id']}", headers=headers, json={"amount": amount})
    assert resp.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("resource", ["accounts", "pots", "plans", "transactions"])
async def test_collection_routes_work_with_and_without_trailing_slash(client: AsyncClient, resource: str):
    headers = create_auth_headers()
    for path in (f"/api/v1/{resource}", f"/api/v1/{resource}/"):
        resp = await client.get(path, headers=headers, follow_redirects=False)
        assert resp.status_code == 200
