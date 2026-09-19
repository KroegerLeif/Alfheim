"""Tests for backend_shared.household (membership-API backed household authorization)."""

import uuid

import httpx
import pytest
from backend_shared import household as hh
from backend_shared.household import (
    HouseholdConfigError,
    HouseholdContext,
    HouseholdMembershipClient,
    MembershipServiceError,
    configure_household_auth,
    derive_user_id,
    get_membership_lookup,
    require_household,
    require_role,
)
from backend_shared.household.testing import (
    StaticMembershipLookup,
    make_household_context,
    make_test_token,
    override_household,
    override_membership,
)
from backend_shared.tls import EXTRA_CA_FILE_ENV
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

HOUSEHOLD = uuid.UUID("11111111-2222-3333-4444-555555555555")
SUB = "301234567890123456"  # Zitadel-style numeric subject
TOKEN = "internal-secret"


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    monkeypatch.delenv("ALFHEIM_INTERNAL_TOKEN", raising=False)
    monkeypatch.delenv("HOUSEHOLD_INTERNAL_URL", raising=False)
    monkeypatch.setattr(hh, "_default_client", None)
    monkeypatch.setattr(hh, "_auth_settings", None)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class Recorder:
    """httpx MockTransport handler recording requests and replaying a configurable response."""

    def __init__(self, status_code: int = 200, json_body: object = None, exc: Exception | None = None) -> None:
        self.status_code = status_code
        self.json_body = json_body
        self.exc = exc
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.exc is not None:
            raise self.exc
        if self.json_body is None and self.status_code == 200:
            hid, sub = request.url.path.split("/")[-2:]
            return httpx.Response(200, json={"household_id": hid, "user_id": sub, "role": "MEMBER"})
        return httpx.Response(self.status_code, json=self.json_body)


def make_client(recorder: Recorder, clock: FakeClock | None = None, **kwargs) -> HouseholdMembershipClient:
    return HouseholdMembershipClient(
        base_url="http://household.test:8080/",
        token=TOKEN,
        transport=httpx.MockTransport(recorder),
        clock=clock or FakeClock(),
        **kwargs,
    )


def build_app(lookup) -> FastAPI:
    app = FastAPI()

    @app.get("/ctx")
    async def ctx(context: HouseholdContext = Depends(require_household)):
        return {
            "user_sub": context.user_sub,
            "user_id": str(context.user_id),
            "household_id": str(context.household_id),
            "role": context.role,
            "email": context.email,
            "username": context.username,
        }

    @app.get("/admin")
    async def admin(context: HouseholdContext = Depends(require_role("OWNER", "ADMIN"))):
        return {"role": context.role}

    app.dependency_overrides[get_membership_lookup] = lambda: lookup
    return app


def auth_headers(sub: str = SUB, household: object = HOUSEHOLD, **claims) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {make_test_token(sub, **claims)}"}
    if household is not None:
        headers["X-Household-ID"] = str(household)
    return headers


# --------------------------------------------------------------------------- dependency


def test_member_gets_context_and_calls_membership_api():
    recorder = Recorder()
    client = TestClient(build_app(make_client(recorder)))

    resp = client.get("/ctx", headers=auth_headers(email="a@b.c", preferred_username="alice"))

    assert resp.status_code == 200
    assert resp.json() == {
        "user_sub": SUB,
        "user_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, SUB)),
        "household_id": str(HOUSEHOLD),
        "role": "MEMBER",
        "email": "a@b.c",
        "username": "alice",
    }
    [request] = recorder.requests
    assert str(request.url) == f"http://household.test:8080/internal/v1/memberships/{HOUSEHOLD}/{SUB}"
    assert request.headers["Authorization"] == f"Bearer {TOKEN}"


def test_user_id_derivation():
    uuid_sub = "8f14e45f-ceea-467a-9575-9b3a6f5a1f00"
    assert derive_user_id(uuid_sub) == uuid.UUID(uuid_sub)
    assert derive_user_id("alice") == uuid.uuid5(uuid.NAMESPACE_DNS, "alice")


def test_sub_is_url_encoded():
    recorder = Recorder()
    client = TestClient(build_app(make_client(recorder)))
    assert client.get("/ctx", headers=auth_headers(sub="a/b c")).status_code == 200
    assert recorder.requests[0].url.raw_path.decode().endswith("/a%2Fb%20c")


def test_non_member_is_forbidden():
    client = TestClient(build_app(make_client(Recorder(404, {"error": "not_found"}))))
    resp = client.get("/ctx", headers=auth_headers())
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "household_forbidden"


@pytest.mark.parametrize(
    "recorder",
    [
        Recorder(401, {"error": "unauthorized"}),
        Recorder(500, {"error": "internal_server_error"}),
        Recorder(503, {"error": "service_unavailable"}),
        Recorder(400, {"error": "bad_request"}),
        Recorder(200, {"role": "EMPEROR"}),
        Recorder(200, ["not", "an", "object"]),
        Recorder(exc=httpx.ReadTimeout("slow")),
        Recorder(exc=httpx.ConnectError("refused")),
    ],
    ids=["401", "500", "503", "400", "unknown-role", "bad-body", "timeout", "connect-error"],
)
def test_membership_service_failures_are_503(recorder):
    client = TestClient(build_app(make_client(recorder)))
    resp = client.get("/ctx", headers=auth_headers())
    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "household_service_unavailable"


def test_non_json_body_is_503():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<html>")

    lookup = HouseholdMembershipClient(base_url="http://h.test", token=TOKEN, transport=httpx.MockTransport(handler))
    resp = TestClient(build_app(lookup)).get("/ctx", headers=auth_headers())
    assert resp.status_code == 503


@pytest.mark.parametrize(
    ("household", "code"),
    [(None, "household_required"), ("  ", "household_required"), ("42", "household_invalid")],
)
def test_bad_household_header_is_400(household, code):
    recorder = Recorder()
    client = TestClient(build_app(make_client(recorder)))
    resp = client.get("/ctx", headers=auth_headers(household=household))
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == code
    assert recorder.requests == []


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic abc"},
        {"Authorization": "Bearer not-a-jwt"},
        {"Authorization": f"Bearer {make_test_token('')}"},
    ],
    ids=["missing", "wrong-scheme", "garbage", "empty-sub"],
)
def test_unauthenticated_is_401(headers):
    recorder = Recorder()
    client = TestClient(build_app(make_client(recorder)))
    resp = client.get("/ctx", headers={**headers, "X-Household-ID": str(HOUSEHOLD)})
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "unauthenticated"
    assert resp.headers["WWW-Authenticate"] == "Bearer"
    assert recorder.requests == []


def test_positive_result_cached_30s():
    recorder, clock = Recorder(), FakeClock()
    client = TestClient(build_app(make_client(recorder, clock)))

    assert client.get("/ctx", headers=auth_headers()).status_code == 200
    clock.now += 29
    assert client.get("/ctx", headers=auth_headers()).status_code == 200
    assert len(recorder.requests) == 1

    clock.now += 2
    assert client.get("/ctx", headers=auth_headers()).status_code == 200
    assert len(recorder.requests) == 2


def test_negative_result_cached_5s_then_expires():
    recorder, clock = Recorder(404, {"error": "not_found"}), FakeClock()
    client = TestClient(build_app(make_client(recorder, clock)))

    assert client.get("/ctx", headers=auth_headers()).status_code == 403
    clock.now += 4
    assert client.get("/ctx", headers=auth_headers()).status_code == 403
    assert len(recorder.requests) == 1

    # Membership granted meanwhile: visible once the negative entry expires.
    recorder.status_code, recorder.json_body = 200, None
    clock.now += 2
    assert client.get("/ctx", headers=auth_headers()).status_code == 200
    assert len(recorder.requests) == 2


def test_errors_are_not_cached():
    recorder = Recorder(500, {})
    client = TestClient(build_app(make_client(recorder)))
    assert client.get("/ctx", headers=auth_headers()).status_code == 503
    recorder.status_code, recorder.json_body = 200, None
    assert client.get("/ctx", headers=auth_headers()).status_code == 200
    assert len(recorder.requests) == 2


def test_cache_is_keyed_by_household_and_sub():
    recorder = Recorder()
    client = TestClient(build_app(make_client(recorder)))
    other = uuid.uuid4()
    client.get("/ctx", headers=auth_headers())
    client.get("/ctx", headers=auth_headers(sub="other"))
    client.get("/ctx", headers=auth_headers(household=other))
    client.get("/ctx", headers=auth_headers())
    assert len(recorder.requests) == 3


@pytest.mark.asyncio
async def test_cache_is_bounded(monkeypatch):
    monkeypatch.setattr(hh, "_MAX_CACHE_ENTRIES", 3)
    recorder, clock = Recorder(), FakeClock()
    lookup = make_client(recorder, clock)
    for i in range(3):
        await lookup(HOUSEHOLD, f"u{i}")
    clock.now += 60  # all expired -> pruned on next insert
    await lookup(HOUSEHOLD, "u3")
    assert len(lookup._cache) == 1
    for i in range(4, 7):
        await lookup(HOUSEHOLD, f"u{i}")  # still fresh -> full clear when the cap is hit
    assert len(lookup._cache) <= 3
    lookup.clear_cache()
    assert lookup._cache == {}
    await lookup.aclose()
    await lookup.aclose()


# --------------------------------------------------------------------------- require_role


@pytest.mark.parametrize(("role", "expected"), [("OWNER", 200), ("ADMIN", 200), ("MEMBER", 403), ("GUEST", 403)])
def test_require_role(role, expected):
    app = build_app(StaticMembershipLookup({(HOUSEHOLD, SUB): role}))
    resp = TestClient(app).get("/admin", headers=auth_headers())
    assert resp.status_code == expected
    if expected == 403:
        assert resp.json()["detail"]["code"] == "household_role_forbidden"
    else:
        assert resp.json() == {"role": role}


def test_require_role_validates_arguments():
    with pytest.raises(ValueError):
        require_role()
    with pytest.raises(ValueError):
        require_role("ROOT")  # ty: ignore[invalid-argument-type]


# --------------------------------------------------------------------------- configuration


@pytest.mark.asyncio
async def test_missing_token_outside_tests_fails_loudly(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(HouseholdConfigError, match="ALFHEIM_INTERNAL_TOKEN"):
        configure_household_auth(object())

    recorder = Recorder()
    lookup = HouseholdMembershipClient(base_url="http://h.test", transport=httpx.MockTransport(recorder))
    with pytest.raises(MembershipServiceError):
        await lookup(HOUSEHOLD, SUB)
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_env_configuration(monkeypatch):
    monkeypatch.setenv("HOUSEHOLD_INTERNAL_URL", "http://hh.internal:9000/")
    monkeypatch.setenv("ALFHEIM_INTERNAL_TOKEN", " env-token ")
    settings = object()
    configure_household_auth(settings)
    assert hh.get_auth_settings() is settings

    client = hh.get_membership_client()
    assert client is hh.get_membership_client()
    assert client.base_url == "http://hh.internal:9000"
    assert client.internal_token() == "env-token"
    await hh.close_membership_client()
    await hh.close_membership_client()
    assert hh._default_client is None


def test_default_url_and_invalid_url(monkeypatch):
    assert HouseholdMembershipClient().base_url == "http://household-backend:8080"
    monkeypatch.setenv("HOUSEHOLD_INTERNAL_URL", "household-backend:8080")
    with pytest.raises(HouseholdConfigError, match="HOUSEHOLD_INTERNAL_URL"):
        configure_household_auth(None)


@pytest.mark.asyncio
async def test_test_context_without_token_sends_no_auth_header():
    recorder = Recorder()
    lookup = HouseholdMembershipClient(base_url="http://h.test", transport=httpx.MockTransport(recorder))
    assert await lookup(HOUSEHOLD, SUB) == "MEMBER"
    assert "Authorization" not in recorder.requests[0].headers


@pytest.mark.asyncio
async def test_https_uses_extra_ca_and_bad_ca_is_503(monkeypatch, tmp_path):
    from backend_shared.tls import get_oidc_ssl_context

    get_oidc_ssl_context.cache_clear()
    bad = tmp_path / "missing.pem"
    monkeypatch.setenv(EXTRA_CA_FILE_ENV, str(bad))
    try:
        lookup = HouseholdMembershipClient(base_url="https://h.test", token=TOKEN)
        with pytest.raises(MembershipServiceError):
            await lookup(HOUSEHOLD, SUB)
    finally:
        get_oidc_ssl_context.cache_clear()

    monkeypatch.delenv(EXTRA_CA_FILE_ENV)
    recorder = Recorder()
    lookup = HouseholdMembershipClient(base_url="https://h.test", token=TOKEN, transport=httpx.MockTransport(recorder))
    assert await lookup(HOUSEHOLD, SUB) == "MEMBER"
    await lookup.aclose()


def test_default_lookup_is_shared_client():
    assert get_membership_lookup() is hh.get_membership_client()


# --------------------------------------------------------------------------- testing helpers


def test_override_membership_helper():
    app = build_app(None)
    app.dependency_overrides.clear()
    lookup = override_membership(app, {(str(HOUSEHOLD), SUB): "ADMIN"})
    client = TestClient(app)

    assert client.get("/admin", headers=auth_headers()).status_code == 200
    lookup.set(HOUSEHOLD, SUB, "GUEST")
    assert client.get("/admin", headers=auth_headers()).status_code == 403
    lookup.set(str(HOUSEHOLD), SUB, None)
    assert client.get("/ctx", headers=auth_headers()).status_code == 403
    assert lookup.calls == [(HOUSEHOLD, SUB)] * 3

    with pytest.raises(ValueError):
        StaticMembershipLookup({(HOUSEHOLD, SUB): "ROOT"})  # ty: ignore[invalid-argument-type]


def test_override_household_helper():
    app = build_app(None)
    ctx = override_household(app, role="GUEST", sub="bob", email="bob@x.y")
    client = TestClient(app)
    body = client.get("/ctx").json()
    assert body["user_sub"] == "bob"
    assert body["user_id"] == str(uuid.uuid5(uuid.NAMESPACE_DNS, "bob"))
    assert body["household_id"] == str(ctx.household_id)
    assert client.get("/admin").status_code == 403

    explicit = make_household_context(household_id=str(HOUSEHOLD), role="OWNER")
    assert override_household(app, explicit) is explicit
    assert client.get("/admin").status_code == 200
