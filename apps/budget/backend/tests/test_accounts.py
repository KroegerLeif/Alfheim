from decimal import Decimal
from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient
from src.features.accounts.models import AccountType


def create_auth_headers(
    user_id: str | None = None,
    household_id: str | None = None,
) -> dict[str, str]:
    """Helper to generate JWT bearer authorization and X-Household-ID headers."""
    uid = user_id or str(uuid4())
    hid = household_id or str(uuid4())
    payload = {
        "sub": uid,
        "household_id": hid,
    }
    token = jwt.encode(payload, "secret", algorithm="HS256")
    return {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": hid,
    }


@pytest.mark.asyncio
async def test_create_account(client: AsyncClient):
    """Test creating accounts of various types."""
    headers = create_auth_headers()

    # Girokonto / CHECKING
    resp = await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={
            "name": "Main Checking Account",
            "account_type": AccountType.CHECKING,
            "balance": "1500.50",
            "currency": "EUR",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Checking Account"
    assert data["account_type"] == "CHECKING"
    assert Decimal(data["balance"]) == Decimal("1500.50")
    account_id = data["id"]

    # Bausparer / BUILDING_SAVINGS with target amount & maturity date
    resp_bs = await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={
            "name": "Home Bausparer",
            "account_type": AccountType.BUILDING_SAVINGS,
            "balance": "5000.00",
            "currency": "EUR",
            "target_amount": "20000.00",
            "maturity_date": "2030-12-31",
        },
    )
    assert resp_bs.status_code == 201
    data_bs = resp_bs.json()
    assert data_bs["account_type"] == "BUILDING_SAVINGS"
    assert Decimal(data_bs["target_amount"]) == Decimal("20000.00")
    assert data_bs["maturity_date"] == "2030-12-31"

    # Get created checking account
    resp_get = await client.get(f"/api/v1/accounts/{account_id}", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["id"] == account_id


@pytest.mark.asyncio
async def test_household_isolation(client: AsyncClient):
    """Test that accounts created by Household A cannot be accessed by Household B."""
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()

    resp = await client.post(
        "/api/v1/accounts/",
        headers=headers_a,
        json={
            "name": "Household A Account",
            "account_type": AccountType.SAVINGS,
            "balance": "3000.00",
        },
    )
    assert resp.status_code == 201
    acc_id_a = resp.json()["id"]

    # Household B attempts to access account of Household A -> 404
    resp_b_get = await client.get(f"/api/v1/accounts/{acc_id_a}", headers=headers_b)
    assert resp_b_get.status_code == 404

    # Household B listing should be empty
    resp_b_list = await client.get("/api/v1/accounts/", headers=headers_b)
    assert resp_b_list.status_code == 200
    assert len(resp_b_list.json()) == 0


@pytest.mark.asyncio
async def test_net_worth_and_summary_aggregates(client: AsyncClient):
    """Test net worth calculation (Liquid vs Investments) and balance breakdown."""
    headers = create_auth_headers()

    # Create 1 CHECKING (Liquid) -> 1000
    await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Checking", "account_type": AccountType.CHECKING, "balance": "1000.00"},
    )
    # Create 1 SAVINGS (Liquid) -> 2000
    await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Savings", "account_type": AccountType.SAVINGS, "balance": "2000.00"},
    )
    # Create 1 INVESTMENT (Investments) -> 5000
    await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Depot", "account_type": AccountType.INVESTMENT, "balance": "5000.00"},
    )
    # Create 1 BUILDING_SAVINGS (Investments) -> 4000
    await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={
            "name": "Bausparer",
            "account_type": AccountType.BUILDING_SAVINGS,
            "balance": "4000.00",
            "target_amount": "10000.00",
        },
    )

    # Test balance summary endpoint
    resp_sum = await client.get("/api/v1/accounts/summary", headers=headers)
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    assert Decimal(sum_data["total_balance"]) == Decimal("12000.00")
    assert Decimal(sum_data["by_type"]["CHECKING"]) == Decimal("1000.00")
    assert Decimal(sum_data["by_type"]["SAVINGS"]) == Decimal("2000.00")
    assert Decimal(sum_data["by_type"]["INVESTMENT"]) == Decimal("5000.00")
    assert Decimal(sum_data["by_type"]["BUILDING_SAVINGS"]) == Decimal("4000.00")

    # Test net worth summary endpoint
    resp_nw = await client.get("/api/v1/accounts/net-worth", headers=headers)
    assert resp_nw.status_code == 200
    nw_data = resp_nw.json()
    assert Decimal(nw_data["liquid_assets"]) == Decimal("3000.00")  # 1000 + 2000
    assert Decimal(nw_data["investments"]) == Decimal("9000.00")  # 5000 + 4000
    assert Decimal(nw_data["total_net_worth"]) == Decimal("12000.00")
    assert nw_data["accounts_count"] == 4


@pytest.mark.asyncio
async def test_update_and_delete_account(client: AsyncClient):
    """Test patch update and deletion of accounts."""
    headers = create_auth_headers()

    resp = await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Old Name", "account_type": AccountType.CHECKING, "balance": "100.00"},
    )
    acc_id = resp.json()["id"]

    # Update balance and name
    resp_update = await client.patch(
        f"/api/v1/accounts/{acc_id}",
        headers=headers,
        json={"name": "Updated Name", "balance": "250.00"},
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["name"] == "Updated Name"
    assert Decimal(resp_update.json()["balance"]) == Decimal("250.00")

    # Delete account
    resp_del = await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert resp_del.status_code == 204

    # Verify 404 after deletion
    resp_get = await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert resp_get.status_code == 404
