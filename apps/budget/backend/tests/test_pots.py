from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient
from src.features.pots.models import OverflowTarget


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
async def test_create_and_get_pot(client: AsyncClient):
    """Test creating and retrieving a virtual pot."""
    headers = create_auth_headers()

    resp = await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={
            "name": "Emergency Fund",
            "priority": 1,
            "target_amount": "5000.00",
            "current_amount": "1000.00",
            "monthly_contribution": "200.00",
            "overflow_target": OverflowTarget.CASCADE,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Emergency Fund"
    assert data["priority"] == 1
    assert Decimal(data["target_amount"]) == Decimal("5000.00")
    assert Decimal(data["current_amount"]) == Decimal("1000.00")
    pot_id = data["id"]

    # Get created pot by ID
    get_resp = await client.get(f"/api/v1/pots/{pot_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == pot_id


@pytest.mark.asyncio
async def test_pot_household_isolation(client: AsyncClient):
    """Test multi-tenancy isolation for virtual pots."""
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()

    create_resp = await client.post(
        "/api/v1/pots/",
        headers=headers_a,
        json={"name": "Household A Pot", "priority": 2, "target_amount": "1000.00"},
    )
    assert create_resp.status_code == 201
    pot_id_a = create_resp.json()["id"]

    # Household B attempt to retrieve Pot A -> 404
    get_b_resp = await client.get(f"/api/v1/pots/{pot_id_a}", headers=headers_b)
    assert get_b_resp.status_code == 404

    # Household B listing should be empty
    list_b_resp = await client.get("/api/v1/pots/", headers=headers_b)
    assert list_b_resp.status_code == 200
    assert len(list_b_resp.json()) == 0


@pytest.mark.asyncio
async def test_cascade_allocation_overflow(client: AsyncClient):
    """Test priority cascade fund allocation overflow across pots."""
    headers = create_auth_headers()

    # Pot Priority 1: Target 500, Current 300 (Shortfall: 200), Overflow = CASCADE
    await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={
            "name": "Fixed Bills",
            "priority": 1,
            "target_amount": "500.00",
            "current_amount": "300.00",
            "overflow_target": OverflowTarget.CASCADE,
        },
    )

    # Pot Priority 2: Target 300, Current 100 (Shortfall: 200), Overflow = UNASSIGNED
    await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={
            "name": "Vacation Fund",
            "priority": 2,
            "target_amount": "300.00",
            "current_amount": "100.00",
            "overflow_target": OverflowTarget.UNASSIGNED,
        },
    )

    # Allocate 500.00:
    # Priority 1 takes 200.00 (reaches target 500.00) -> 300.00 remaining cascades to Priority 2
    # Priority 2 takes 200.00 (reaches target 300.00) -> 100.00 remaining goes to UNASSIGNED buffer
    cascade_resp = await client.post(
        "/api/v1/pots/cascade",
        headers=headers,
        json={"amount": "500.00"},
    )
    assert cascade_resp.status_code == 200
    cdata = cascade_resp.json()
    assert Decimal(cdata["total_allocated"]) == Decimal("400.00")
    assert Decimal(cdata["remaining_unassigned"]) == Decimal("100.00")
    assert Decimal(cdata["overflow_to_investment"]) == Decimal("0.00")
    assert len(cdata["allocations"]) == 2


@pytest.mark.asyncio
async def test_sinking_fund_calculator(client: AsyncClient):
    """Test sinking fund dynamic target rate, gap detection, and warning status."""
    headers = create_auth_headers()

    ref_date = date(2025, 1, 1)
    due_date = date(2025, 11, 1)  # 10 months away

    # Target = 1000, Current = 0 => Shortfall = 1000 over 10 months => Target Rate = 100/month
    # Monthly Contribution = 40 => Gap = 60/month => Warning
    pot_resp = await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={
            "name": "Annual Car Insurance",
            "priority": 1,
            "target_amount": "1000.00",
            "current_amount": "0.00",
            "monthly_contribution": "40.00",
            "target_date": due_date.isoformat(),
        },
    )
    pot_id = pot_resp.json()["id"]

    calc_resp = await client.get(
        f"/api/v1/pots/{pot_id}/sinking-fund-calculator?reference_date={ref_date.isoformat()}",
        headers=headers,
    )
    assert calc_resp.status_code == 200
    calc_data = calc_resp.json()
    assert Decimal(calc_data["shortfall"]) == Decimal("1000.00")
    assert calc_data["remaining_months"] == 10
    assert Decimal(calc_data["target_monthly_rate"]) == Decimal("100.00")
    assert Decimal(calc_data["actual_monthly_rate"]) == Decimal("40.00")
    assert Decimal(calc_data["gap"]) == Decimal("60.00")
    assert calc_data["has_gap"] is True
    assert calc_data["status"] == "WARNING"


@pytest.mark.asyncio
async def test_maintenance_reserve_endpoint(client: AsyncClient):
    """Test maintenance reserve request from external apps."""
    headers = create_auth_headers()

    due_date = (date.today() + timedelta(days=60)).isoformat()

    reserve_resp = await client.post(
        "/api/v1/pots/maintenance-reserve",
        headers=headers,
        json={
            "title": "Washing Machine Filter Replacement",
            "required_amount": "250.00",
            "due_date": due_date,
            "priority": 1,
        },
    )
    assert reserve_resp.status_code == 201
    rdata = reserve_resp.json()
    assert rdata["name"] == "Washing Machine Filter Replacement"
    assert Decimal(rdata["target_amount"]) == Decimal("250.00")
    assert rdata["priority"] == 1

    # Repeat request with updated target amount -> updates existing pot
    update_reserve_resp = await client.post(
        "/api/v1/pots/maintenance-reserve",
        headers=headers,
        json={
            "title": "Washing Machine Filter Replacement",
            "required_amount": "300.00",
            "due_date": due_date,
            "priority": 1,
        },
    )
    assert update_reserve_resp.status_code == 201
    urdata = update_reserve_resp.json()
    assert urdata["id"] == rdata["id"]
    assert Decimal(urdata["target_amount"]) == Decimal("300.00")


@pytest.mark.asyncio
async def test_update_and_delete_pot(client: AsyncClient):
    """Test updating and deleting a pot."""
    headers = create_auth_headers()

    create_resp = await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={"name": "Temp Pot", "priority": 5},
    )
    pot_id = create_resp.json()["id"]

    # Patch update
    patch_resp = await client.patch(
        f"/api/v1/pots/{pot_id}",
        headers=headers,
        json={"name": "Renamed Pot", "priority": 3},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Renamed Pot"
    assert patch_resp.json()["priority"] == 3

    # Delete
    del_resp = await client.delete(f"/api/v1/pots/{pot_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify 404
    get_resp = await client.get(f"/api/v1/pots/{pot_id}", headers=headers)
    assert get_resp.status_code == 404
