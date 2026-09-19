"""Households are listed from the household app's ``GET /api/v1/households/me`` with the caller's token."""

import uuid

import httpx
import pytest
from backend_shared.household.testing import DEFAULT_TEST_HOUSEHOLD_ID, DEFAULT_TEST_SUB
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.shopping_lists.clients import household_client
from src.features.shopping_lists.clients.household_client import fetch_my_households, household_api_base_url
from src.features.shopping_lists.services.list_management_service import ListManagementService


def _household(hh_id: uuid.UUID, name: str, role: str = "MEMBER", is_default: bool = False) -> dict:
    return {"id": str(hh_id), "name": name, "slug": name.lower(), "role": role, "is_default": is_default}


def test_base_url_uses_household_internal_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("HOUSEHOLD_INTERNAL_URL", "http://household.internal:9000/")
    assert household_api_base_url() == "http://household.internal:9000"


async def test_households_me_proxies_household_app_with_caller_token(client: AsyncClient, household_api, auth_headers):
    other = uuid.uuid4()
    household_api.households.append(_household(other, "Cabin"))

    res = await client.get("/api/v1/households/me")
    assert res.status_code == 200
    body = res.json()
    assert [h["id"] for h in body] == [str(DEFAULT_TEST_HOUSEHOLD_ID), str(other)]
    assert body[0]["role"] == "OWNER"
    assert body[0]["is_default"] is True

    request = household_api.requests[-1]
    assert request.url.path == "/api/v1/households/me"
    assert request.headers["Authorization"] == auth_headers()["Authorization"]


async def test_households_me_returns_empty_list_on_failure(client: AsyncClient, household_api):
    household_api.status_code = 503
    res = await client.get("/api/v1/households/me")
    assert res.status_code == 200
    assert res.json() == []


async def test_get_lists_includes_households_from_household_app(client: AsyncClient, household_api, db_session):
    cabin = uuid.uuid4()
    household_api.households.append(_household(cabin, "Cabin"))

    res = await client.get("/api/v1/shopping-lists")
    assert res.status_code == 200
    default_homes = {lst["home_id"] for lst in res.json() if lst["is_default"]}
    assert default_homes == {str(DEFAULT_TEST_HOUSEHOLD_ID), str(cabin)}


@pytest.mark.parametrize(
    "failure",
    ["status", "network", "bad_json", "not_a_list"],
)
async def test_get_lists_falls_back_to_active_household_only(
    db_session: AsyncSession, household_api, monkeypatch: pytest.MonkeyPatch, failure: str
):
    """No fail-open: when the household app cannot answer, only the (already authorized) active household is used."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    def handler(request: httpx.Request) -> httpx.Response:
        if failure == "network":
            raise httpx.ConnectError("down", request=request)
        if failure == "bad_json":
            return httpx.Response(200, content=b"not json")
        if failure == "not_a_list":
            return httpx.Response(200, json={"households": []})
        return httpx.Response(500)

    monkeypatch.setattr(household_client, "transport", httpx.MockTransport(handler))

    lists = await ListManagementService.get_lists(db_session, home_id=home_id, owner_id=owner_id, token="Bearer t")
    assert {lst.home_id for lst in lists if lst.is_default} == {home_id}


async def test_get_lists_without_token_uses_active_household(db_session: AsyncSession, household_api):
    home_id = uuid.uuid4()
    lists = await ListManagementService.get_lists(db_session, home_id=home_id, owner_id=uuid.uuid4())
    assert {lst.home_id for lst in lists if lst.is_default} == {home_id}
    assert household_api.requests == []


async def test_get_lists_ignores_invalid_household_ids(db_session: AsyncSession, household_api):
    home_id = uuid.uuid4()
    household_api.households = [{"id": "not-a-uuid", "name": "Broken"}, _household(home_id, "Active")]
    lists = await ListManagementService.get_lists(db_session, home_id=home_id, owner_id=uuid.uuid4(), token="raw")
    assert {lst.home_id for lst in lists if lst.is_default} == {home_id}
    assert household_api.requests[-1].headers["Authorization"] == "Bearer raw"


async def test_fetch_my_households_filters_non_objects(household_api):
    household_api.households = [_household(uuid.uuid4(), "A"), "junk", 3]
    result = await fetch_my_households(f"Bearer {DEFAULT_TEST_SUB}")
    assert result is not None
    assert len(result) == 1
