"""Household-bound service principals in backend_shared.household (#958)."""

import uuid
from typing import Any

import httpx
import pytest
from backend_shared import household as hh
from backend_shared.household import (
    HouseholdContext,
    HouseholdMembershipClient,
    MembershipServiceError,
    ServiceGrant,
    get_membership_lookup,
    require_household,
    require_household_access,
    require_role,
    resolve_household_context,
)
from backend_shared.household.service_principals import admits_service, normalize_service_scopes
from backend_shared.household.testing import StaticMembershipLookup, make_test_token
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

HOUSEHOLD = uuid.UUID("11111111-2222-3333-4444-555555555555")
OTHER = uuid.UUID("99999999-2222-3333-4444-555555555555")
PRINCIPAL = "integrations-principal"
MEMBER = "member-sub"
SCOPE = "chores:create_instance"


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    monkeypatch.setattr(hh, "_default_client", None)
    monkeypatch.setattr(hh, "_auth_settings", None)


def headers(sub: str, household: uuid.UUID = HOUSEHOLD) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_test_token(sub)}", "X-Household-ID": str(household)}


def build_app(lookup) -> FastAPI:
    app = FastAPI()

    def describe(context: HouseholdContext) -> dict[str, object]:
        return {"role": context.role, "service": context.is_service, "scopes": sorted(context.scopes)}

    @app.post("/opted-in")
    async def opted_in(
        context: HouseholdContext = Depends(
            require_household_access(roles=("OWNER", "ADMIN", "MEMBER"), allow_service_scopes=[SCOPE])
        ),
    ):
        return describe(context)

    @app.post("/any-member")
    async def any_member(context: HouseholdContext = Depends(require_household_access(allow_service_scopes=[SCOPE]))):
        return describe(context)

    @app.get("/plain")
    async def plain(context: HouseholdContext = Depends(require_household)):
        return describe(context)

    @app.get("/writer")
    async def writer(context: HouseholdContext = Depends(require_role("OWNER", "ADMIN", "MEMBER"))):
        return describe(context)

    app.dependency_overrides[get_membership_lookup] = lambda: lookup
    return app


@pytest.fixture
def lookup() -> StaticMembershipLookup:
    static = StaticMembershipLookup({(HOUSEHOLD, MEMBER): "MEMBER", (HOUSEHOLD, "guest"): "GUEST"})
    static.grant_service(HOUSEHOLD, PRINCIPAL, [SCOPE])
    return static


def test_bound_principal_passes_opted_in_endpoint(lookup):
    client = TestClient(build_app(lookup))
    resp = client.post("/opted-in", headers=headers(PRINCIPAL))
    assert resp.status_code == 200
    assert resp.json() == {"role": "SERVICE", "service": True, "scopes": [SCOPE]}


@pytest.mark.parametrize(
    ("method", "path", "household"),
    [("post", "/opted-in", OTHER), ("get", "/plain", HOUSEHOLD), ("get", "/writer", HOUSEHOLD)],
)
def test_principal_rejected_elsewhere(lookup, method, path, household):
    resp = getattr(TestClient(build_app(lookup)), method)(path, headers=headers(PRINCIPAL, household))
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "household_forbidden"


def test_principal_without_scope_is_rejected(lookup):
    lookup.grant_service(HOUSEHOLD, PRINCIPAL, ["pantry:add_item"])
    resp = TestClient(build_app(lookup)).post("/opted-in", headers=headers(PRINCIPAL))
    assert resp.status_code == 403


def test_revocation_applies_to_the_next_request(lookup):
    client = TestClient(build_app(lookup))
    assert client.post("/opted-in", headers=headers(PRINCIPAL)).status_code == 200
    lookup.grant_service(HOUSEHOLD, PRINCIPAL, None)
    assert client.post("/opted-in", headers=headers(PRINCIPAL)).status_code == 403


def test_members_keep_their_behaviour(lookup):
    client = TestClient(build_app(lookup))
    member = client.post("/opted-in", headers=headers(MEMBER))
    assert member.json() == {"role": "MEMBER", "service": False, "scopes": []}
    assert client.get("/plain", headers=headers(MEMBER)).status_code == 200
    guest = client.post("/opted-in", headers=headers("guest"))
    assert guest.status_code == 403
    assert guest.json()["detail"]["code"] == "household_role_forbidden"
    assert client.post("/any-member", headers=headers("guest")).status_code == 200
    assert client.post("/opted-in", headers=headers("stranger")).status_code == 403


def test_require_household_access_validates_arguments():
    with pytest.raises(ValueError):
        require_household_access()
    unknown_roles: Any = ("KING",)
    with pytest.raises(ValueError):
        require_household_access(roles=unknown_roles, allow_service_scopes=[SCOPE])
    # A bare string would be iterated per character; the type checker cannot see this misuse.
    bare_string: Any = SCOPE
    with pytest.raises(TypeError):
        require_household_access(allow_service_scopes=bare_string)
    with pytest.raises(ValueError):
        normalize_service_scopes(["no-colon"])
    assert not admits_service(frozenset(), frozenset({SCOPE}))


@pytest.mark.asyncio
async def test_resolve_rejects_service_by_default(lookup):
    with pytest.raises(hh.HouseholdAuthError) as exc:
        await resolve_household_context(f"Bearer {make_test_token(PRINCIPAL)}", str(HOUSEHOLD), lookup=lookup)
    assert exc.value.status_code == 403
    ctx = await resolve_household_context(
        f"Bearer {make_test_token(PRINCIPAL)}", str(HOUSEHOLD), lookup=lookup, allow_service_scopes=[SCOPE]
    )
    assert ctx.has_scope(SCOPE)
    assert not ctx.has_scope("pantry:add_item")


def _client(handler) -> HouseholdMembershipClient:
    return HouseholdMembershipClient(
        base_url="http://household.test:8080", token="internal-secret", transport=httpx.MockTransport(handler)
    )


@pytest.mark.asyncio
async def test_client_parses_and_never_caches_service_grants():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        body = {"household_id": str(HOUSEHOLD), "user_id": PRINCIPAL, "role": "SERVICE", "scopes": [SCOPE]}
        return httpx.Response(200, json=body)

    client = _client(handler)
    assert await client(HOUSEHOLD, PRINCIPAL) == ServiceGrant(frozenset({SCOPE}))
    assert await client(HOUSEHOLD, PRINCIPAL) == ServiceGrant(frozenset({SCOPE}))
    assert len(calls) == 2
    await client.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize("scopes", [None, "chores:create_instance", [1]])
async def test_client_rejects_unreadable_service_scopes(scopes):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"role": "SERVICE", "scopes": scopes})

    client = _client(handler)
    with pytest.raises(MembershipServiceError):
        await client(HOUSEHOLD, PRINCIPAL)
    await client.aclose()
