"""Household authorization contract (backend_shared.household.require_household) on workout routes."""

import uuid
from unittest.mock import patch

from backend_shared.household import MembershipServiceError
from backend_shared.household.testing import StaticMembershipLookup
from httpx import AsyncClient


async def test_workout_non_member_household_rejected(client: AsyncClient, auth_headers):
    response = await client.get("/api/v1/plans", headers=auth_headers(household_id=uuid.uuid4()))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


async def test_workout_other_user_cannot_start_session_in_household(client: AsyncClient, auth_headers):
    response = await client.post("/api/v1/sessions", json={}, headers=auth_headers(sub="intruder"))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"


async def test_workout_missing_household_header_rejected(client: AsyncClient):
    client.headers.pop("X-Household-ID")
    response = await client.get("/api/v1/plans")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_required"


async def test_workout_invalid_household_header_rejected(client: AsyncClient):
    response = await client.get("/api/v1/plans", headers={"X-Household-ID": "not-a-uuid"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "household_invalid"


async def test_workout_unauthenticated_rejected(client: AsyncClient):
    client.headers.pop("Authorization")
    response = await client.get("/api/v1/plans")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"


async def test_workout_membership_service_unavailable(client: AsyncClient):
    with patch.object(StaticMembershipLookup, "__call__", side_effect=MembershipServiceError("down")):
        response = await client.get("/api/v1/plans")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "household_service_unavailable"


async def test_workout_unsigned_token_rejected_in_production(client: AsyncClient):
    with patch("src.core.config.settings.ENVIRONMENT", "production"):
        response = await client.get("/api/v1/plans")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthenticated"
