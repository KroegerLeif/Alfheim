"""Tests for the MCP middleware: same authorization path as require_household, context via contextvar/scope."""

import uuid
from types import SimpleNamespace

import pytest
from backend_shared import household as hh
from backend_shared import mcp_middleware
from backend_shared.household import HouseholdContext, MembershipServiceError
from backend_shared.household.testing import (
    StaticMembershipLookup,
    make_household_context,
    make_test_token,
    mcp_household_context,
)
from backend_shared.mcp_middleware import (
    MCP_HOUSEHOLD_SCOPE_KEY,
    MCPAuthenticationMiddleware,
    get_mcp_household_context,
    mcp_household_context_var,
)
from fastapi.testclient import TestClient
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

HOUSEHOLD = uuid.UUID("11111111-2222-3333-4444-555555555555")
SUB = "301234567890123456"


async def tool_endpoint(request: Request) -> JSONResponse:
    ctx = get_mcp_household_context()
    assert request.scope[MCP_HOUSEHOLD_SCOPE_KEY] is ctx
    return JSONResponse({"household_id": str(ctx.household_id), "user_id": str(ctx.user_id), "role": ctx.role})


def build(lookup, settings=None) -> TestClient:
    inner = Starlette(routes=[Route("/", tool_endpoint, methods=["GET", "POST"])])
    return TestClient(MCPAuthenticationMiddleware(inner, settings=settings, membership_lookup=lookup))


def headers(sub: str = SUB, household: object = HOUSEHOLD) -> dict[str, str]:
    result = {"Authorization": f"Bearer {make_test_token(sub)}"}
    if household is not None:
        result["X-Household-ID"] = str(household)
    return result


def test_member_context_is_injected():
    client = build(StaticMembershipLookup({(HOUSEHOLD, SUB): "ADMIN"}))
    resp = client.post("/", headers=headers())
    assert resp.status_code == 200
    assert resp.json() == {
        "household_id": str(HOUSEHOLD),
        "user_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, SUB)),
        "role": "ADMIN",
    }
    assert mcp_household_context_var.get() is None  # reset after the request


class FailingLookup:
    async def __call__(self, household_id, user_sub):
        raise MembershipServiceError("down")


class BrokenLookup:
    async def __call__(self, household_id, user_sub):
        raise KeyError("bug")


@pytest.mark.parametrize(
    ("lookup", "hdrs", "status", "code"),
    [
        (StaticMembershipLookup(), headers(), 403, "household_forbidden"),
        (FailingLookup(), headers(), 503, "household_service_unavailable"),
        (StaticMembershipLookup(), headers(household=None), 400, "household_required"),
        (StaticMembershipLookup(), headers(household="1"), 400, "household_invalid"),
        (StaticMembershipLookup(), {"X-Household-ID": str(HOUSEHOLD)}, 401, "unauthenticated"),
        (BrokenLookup(), headers(), 500, "internal_error"),
    ],
    ids=["not-member", "service-down", "missing-header", "invalid-header", "no-jwt", "unexpected"],
)
def test_rejections(lookup, hdrs, status, code):
    resp = build(lookup).post("/", headers=hdrs)
    assert resp.status_code == status
    assert resp.json()["detail"]["code"] == code


def test_defaults_to_shared_client_and_configured_settings(monkeypatch):
    shared = StaticMembershipLookup({(HOUSEHOLD, SUB): "OWNER"})
    monkeypatch.setattr(hh, "_default_client", shared)
    monkeypatch.setattr(hh, "_auth_settings", None)
    assert build(None).get("/", headers=headers()).status_code == 200
    assert shared.calls == [(HOUSEHOLD, SUB)]


def test_get_context_without_middleware_raises():
    with pytest.raises(RuntimeError):
        get_mcp_household_context()


def test_mcp_household_context_helper():
    with mcp_household_context(role="GUEST") as ctx:
        assert get_mcp_household_context() is ctx
        assert ctx.role == "GUEST"
    assert mcp_household_context_var.get() is None


def test_request_scope_wins_over_stale_contextvar(monkeypatch):
    """Stateful MCP sessions reuse the first request's contextvars; the per-request scope is authoritative."""
    from mcp.server.lowlevel.server import request_ctx

    current = make_household_context(household_id=HOUSEHOLD, role="MEMBER")
    stale: HouseholdContext = make_household_context(role="OWNER")
    fake_request = SimpleNamespace(scope={MCP_HOUSEHOLD_SCOPE_KEY: current})
    ctx_token = request_ctx.set(SimpleNamespace(request=fake_request))  # ty: ignore[invalid-argument-type]
    try:
        with mcp_household_context(stale):
            assert get_mcp_household_context() is current
        fake_request.scope = {}
        with mcp_household_context(stale):
            assert get_mcp_household_context() is stale
    finally:
        request_ctx.reset(ctx_token)
    assert mcp_middleware._current_mcp_request_context() is None
