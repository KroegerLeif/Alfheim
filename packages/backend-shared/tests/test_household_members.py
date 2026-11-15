"""Tests for the household member listing client (#583)."""

import uuid

import httpx
import pytest
from backend_shared.household import (
    HouseholdMember,
    HouseholdMembershipClient,
    MembershipServiceError,
    derive_user_id,
    find_member,
    get_member_directory,
)
from backend_shared.household.testing import StaticMembershipLookup, override_membership
from fastapi import FastAPI

HOUSEHOLD = uuid.UUID("11111111-2222-3333-4444-555555555555")
NUMERIC_SUB = "301234567890123456"  # Zitadel-style subject that is not a UUID
UUID_SUB = "6f9619ff-8b86-d011-b42d-00cf4fc964ff"
TOKEN = "internal-secret"


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def members_body(*entries: tuple[str, str]) -> dict:
    return {
        "household_id": str(HOUSEHOLD),
        "members": [{"user_id": sub, "app_user_id": str(derive_user_id(sub)), "role": role} for sub, role in entries],
    }


def make_client(handler, clock: FakeClock | None = None) -> HouseholdMembershipClient:
    return HouseholdMembershipClient(
        base_url="http://household.test:8080/",
        token=TOKEN,
        transport=httpx.MockTransport(handler),
        clock=clock or FakeClock(),
    )


class Recorder:
    def __init__(self, response: httpx.Response | Exception) -> None:
        self.response = response
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


@pytest.mark.asyncio
async def test_list_members_returns_subject_derived_id_and_role():
    recorder = Recorder(httpx.Response(200, json=members_body((NUMERIC_SUB, "OWNER"), (UUID_SUB, "GUEST"))))

    members = await make_client(recorder).list_members(HOUSEHOLD)

    assert members == [
        HouseholdMember(user_sub=NUMERIC_SUB, user_id=derive_user_id(NUMERIC_SUB), role="OWNER"),
        HouseholdMember(user_sub=UUID_SUB, user_id=uuid.UUID(UUID_SUB), role="GUEST"),
    ]
    request = recorder.requests[0]
    assert request.url.path == f"/internal/v1/households/{HOUSEHOLD}/members"
    assert request.headers["Authorization"] == f"Bearer {TOKEN}"


@pytest.mark.asyncio
async def test_find_member_matches_the_derived_id_of_a_non_uuid_subject():
    client = make_client(Recorder(httpx.Response(200, json=members_body((NUMERIC_SUB, "MEMBER")))))

    found = await find_member(client, HOUSEHOLD, derive_user_id(NUMERIC_SUB))
    missing = await find_member(client, HOUSEHOLD, uuid.uuid4())

    assert found is not None and found.user_sub == NUMERIC_SUB
    assert missing is None


@pytest.mark.asyncio
async def test_member_list_is_cached_then_refreshed():
    recorder, clock = Recorder(httpx.Response(200, json=members_body((NUMERIC_SUB, "MEMBER")))), FakeClock()
    client = make_client(recorder, clock)

    first = await client.list_members(HOUSEHOLD)
    first.clear()  # callers get a copy, the cache is unaffected
    clock.now += 29
    assert len(await client.list_members(HOUSEHOLD)) == 1
    assert len(recorder.requests) == 1

    clock.now += 2
    await client.list_members(HOUSEHOLD)
    assert len(recorder.requests) == 2

    client.clear_cache()
    await client.list_members(HOUSEHOLD)
    assert len(recorder.requests) == 3


@pytest.mark.asyncio
async def test_unknown_household_has_no_members_and_is_not_cached():
    recorder = Recorder(httpx.Response(404, json={"error": "not_found"}))
    client = make_client(recorder)

    assert await client.list_members(HOUSEHOLD) == []
    assert await client.list_members(HOUSEHOLD) == []
    assert len(recorder.requests) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={}),
        httpx.Response(500, json={}),
        httpx.Response(200, content=b"not json"),
        httpx.Response(200, json={"members": [{"user_id": "x"}]}),
        httpx.Response(200, json={"members": [{"user_id": "x", "app_user_id": "not-a-uuid", "role": "OWNER"}]}),
        httpx.Response(200, json=members_body((NUMERIC_SUB, "SUPERUSER"))),
        httpx.ConnectError("down"),
    ],
)
async def test_failures_raise_and_are_not_cached(response):
    recorder = Recorder(response)
    client = make_client(recorder)

    for _ in range(2):
        with pytest.raises(MembershipServiceError):
            await client.list_members(HOUSEHOLD)
    assert len(recorder.requests) == 2


@pytest.mark.asyncio
async def test_static_lookup_lists_the_configured_members_of_one_household():
    other = uuid.uuid4()
    lookup = StaticMembershipLookup({(HOUSEHOLD, NUMERIC_SUB): "ADMIN", (other, "someone-else"): "OWNER"})

    members = await lookup.list_members(HOUSEHOLD)

    assert members == [HouseholdMember(user_sub=NUMERIC_SUB, user_id=derive_user_id(NUMERIC_SUB), role="ADMIN")]


def test_override_membership_also_overrides_the_member_directory():
    app = FastAPI()

    lookup = override_membership(app, {(HOUSEHOLD, NUMERIC_SUB): "MEMBER"})

    assert app.dependency_overrides[get_member_directory]() is lookup


def test_default_member_directory_is_the_membership_client(monkeypatch):
    from backend_shared import household as hh

    monkeypatch.setattr(hh, "_default_client", None)
    assert isinstance(get_member_directory(), HouseholdMembershipClient)
