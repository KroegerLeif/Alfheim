from datetime import date
from decimal import Decimal
from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient
from src.features.plans.models import PlanType


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
async def test_create_and_get_plan(client: AsyncClient):
    """Test creating and retrieving MONTHLY and EVENT plans."""
    headers = create_auth_headers()

    # Create MONTHLY plan
    monthly_resp = await client.post(
        "/api/v1/plans/",
        headers=headers,
        json={
            "name": "Standard Monthly Budget",
            "description": "Recurring monthly budget allocation",
            "plan_type": PlanType.MONTHLY,
            "total_budget": "3500.00",
        },
    )
    assert monthly_resp.status_code == 201
    monthly_data = monthly_resp.json()
    assert monthly_data["name"] == "Standard Monthly Budget"
    assert monthly_data["plan_type"] == PlanType.MONTHLY
    assert Decimal(monthly_data["total_budget"]) == Decimal("3500.00")
    plan_id = monthly_data["id"]

    # Get created plan by ID
    get_resp = await client.get(f"/api/v1/plans/{plan_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == plan_id

    # Create EVENT plan
    event_resp = await client.post(
        "/api/v1/plans/",
        headers=headers,
        json={
            "name": "Apartment Relocation",
            "description": "Project budget for moving to new apartment",
            "plan_type": PlanType.EVENT,
            "start_date": date(2025, 6, 1).isoformat(),
            "end_date": date(2025, 7, 31).isoformat(),
            "total_budget": "5000.00",
        },
    )
    assert event_resp.status_code == 201
    assert event_resp.json()["plan_type"] == PlanType.EVENT


@pytest.mark.asyncio
async def test_plan_categories_and_summary(client: AsyncClient):
    """Test creating category hierarchy (e.g., Kitchen -> Refrigerator) and fetching summary."""
    headers = create_auth_headers()

    # Create EVENT Plan
    plan_resp = await client.post(
        "/api/v1/plans/",
        headers=headers,
        json={
            "name": "Kitchen Renovation",
            "plan_type": PlanType.EVENT,
            "total_budget": "4000.00",
        },
    )
    assert plan_resp.status_code == 201
    plan_id = plan_resp.json()["id"]

    # Add parent category: Appliances
    parent_cat_resp = await client.post(
        f"/api/v1/plans/{plan_id}/categories",
        headers=headers,
        json={
            "name": "Appliances",
            "allocated_amount": "1500.00",
        },
    )
    assert parent_cat_resp.status_code == 201
    parent_cat_id = parent_cat_resp.json()["id"]

    # Add subcategory under Appliances: Refrigerator
    sub_cat_resp = await client.post(
        f"/api/v1/plans/{plan_id}/categories",
        headers=headers,
        json={
            "name": "Refrigerator",
            "parent_id": parent_cat_id,
            "allocated_amount": "1200.00",
        },
    )
    assert sub_cat_resp.status_code == 201
    sub_cat_id = sub_cat_resp.json()["id"]
    assert sub_cat_resp.json()["parent_id"] == parent_cat_id

    # Add top-level category: Cabinetry
    await client.post(
        f"/api/v1/plans/{plan_id}/categories",
        headers=headers,
        json={
            "name": "Cabinetry",
            "allocated_amount": "1000.00",
        },
    )

    # Fetch Plan summary
    summary_resp = await client.get(f"/api/v1/plans/{plan_id}/summary", headers=headers)
    assert summary_resp.status_code == 200
    sdata = summary_resp.json()

    assert sdata["plan_id"] == plan_id
    assert Decimal(sdata["total_budget"]) == Decimal("4000.00")
    # Total allocated = 1500 + 1200 + 1000 = 3700
    assert Decimal(sdata["total_allocated"]) == Decimal("3700.00")
    # Unallocated balance = 4000 - 3700 = 300
    assert Decimal(sdata["unallocated_balance"]) == Decimal("300.00")
    assert sdata["categories_count"] == 3

    # Verify hierarchy in summary: 2 root categories (Appliances, Cabinetry)
    assert len(sdata["categories"]) == 2
    appliances_node = next(node for node in sdata["categories"] if node["id"] == parent_cat_id)
    assert len(appliances_node["subcategories"]) == 1
    assert appliances_node["subcategories"][0]["id"] == sub_cat_id


@pytest.mark.asyncio
async def test_plan_household_isolation(client: AsyncClient):
    """Test multi-tenancy isolation for plans and categories."""
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()

    plan_resp_a = await client.post(
        "/api/v1/plans/",
        headers=headers_a,
        json={"name": "Household A Plan", "plan_type": PlanType.MONTHLY, "total_budget": "1000.00"},
    )
    assert plan_resp_a.status_code == 201
    plan_id_a = plan_resp_a.json()["id"]

    # Household B trying to access Plan A -> 404
    get_b_resp = await client.get(f"/api/v1/plans/{plan_id_a}", headers=headers_b)
    assert get_b_resp.status_code == 404

    # Household B trying to view summary of Plan A -> 404
    sum_b_resp = await client.get(f"/api/v1/plans/{plan_id_a}/summary", headers=headers_b)
    assert sum_b_resp.status_code == 404


@pytest.mark.asyncio
async def test_update_and_delete_plan_and_category(client: AsyncClient):
    """Test updating and deleting plans and categories."""
    headers = create_auth_headers()

    create_resp = await client.post(
        "/api/v1/plans/",
        headers=headers,
        json={"name": "Temporary Plan", "plan_type": PlanType.EVENT, "total_budget": "500.00"},
    )
    plan_id = create_resp.json()["id"]

    cat_resp = await client.post(
        f"/api/v1/plans/{plan_id}/categories",
        headers=headers,
        json={"name": "Temp Cat", "allocated_amount": "100.00"},
    )
    cat_id = cat_resp.json()["id"]

    # Update category
    cat_patch = await client.patch(
        f"/api/v1/plans/categories/{cat_id}",
        headers=headers,
        json={"name": "Updated Cat", "allocated_amount": "150.00"},
    )
    assert cat_patch.status_code == 200
    assert cat_patch.json()["name"] == "Updated Cat"

    # Delete category
    cat_del = await client.delete(f"/api/v1/plans/categories/{cat_id}", headers=headers)
    assert cat_del.status_code == 204

    # Update plan
    plan_patch = await client.patch(
        f"/api/v1/plans/{plan_id}",
        headers=headers,
        json={"name": "Updated Plan Name", "total_budget": "750.00"},
    )
    assert plan_patch.status_code == 200
    assert plan_patch.json()["name"] == "Updated Plan Name"

    # Delete plan
    plan_del = await client.delete(f"/api/v1/plans/{plan_id}", headers=headers)
    assert plan_del.status_code == 204

    # Verify 404 after deletion
    get_del = await client.get(f"/api/v1/plans/{plan_id}", headers=headers)
    assert get_del.status_code == 404
