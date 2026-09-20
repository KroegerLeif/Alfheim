"""Tests for the MCP middleware: same authorization path as require_household, context via contextvar/scope."""

import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import pytest
from backend_shared import household as hh
from backend_shared import mcp_middleware
from backend_shared.household import HouseholdContext, MembershipServiceError, testing
from backend_shared.household.testing import (
    StaticMembershipLookup,
    make_household_context,
    make_test_token,
    mcp_household_context,
    mcp_list_tools,
    mcp_membership,
)
from backend_shared.mcp_middleware import (
    MCP_ENDPOINT_PATH,
    MCP_HOUSEHOLD_SCOPE_KEY,
    MCPAuthenticationMiddleware,
    get_mcp_household_context,
    mcp_household_context_var,
    mount_mcp,
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


def _fastmcp_app():
    """A FastAPI app serving a one-tool FastMCP server through :func:`mount_mcp`, lifespans combined."""
    from fastapi import FastAPI
    from fastmcp import FastMCP

    server = FastMCP("test")

    @server.tool
    def whoami() -> str:
        """Return the caller's household."""
        return str(get_mcp_household_context().household_id)

    @asynccontextmanager
    async def lifespan(_app):
        async with mcp_app.router.lifespan_context(mcp_app):
            yield

    app = FastAPI(lifespan=lifespan)
    mcp_app = mount_mcp(app, server)
    return app


@pytest.mark.asyncio
async def test_mount_mcp_serves_exact_path_with_session_manager_running():
    app = _fastmcp_app()
    with mcp_membership({(HOUSEHOLD, SUB): "MEMBER"}) as lookup:
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://svc:8000") as client:
                assert await mcp_list_tools(client, headers()) == ["whoami"]
                unauthenticated = await client.post("/mcp", json={})
                doubled = await client.post("/mcp/mcp", headers=headers(), json={})
    assert lookup.calls
    assert set(lookup.calls) == {(HOUSEHOLD, SUB)}
    assert unauthenticated.status_code == 401
    assert doubled.status_code == 404
    assert [r.path for r in app.routes if getattr(r, "path", "").startswith("/mcp")] == [MCP_ENDPOINT_PATH]


@pytest.mark.asyncio
async def test_mcp_list_tools_accepts_json_responses_and_reports_failures():
    async def endpoint(request: Request) -> JSONResponse:
        body = await request.json()
        if body.get("method") == "notifications/initialized":
            return JSONResponse(None, status_code=202)
        result = {"tools": [{"name": "t1"}]} if body["method"] == "tools/list" else {"protocolVersion": "x"}
        return JSONResponse({"jsonrpc": "2.0", "id": body["id"], "result": result})

    ok = Starlette(routes=[Route("/mcp", endpoint, methods=["POST"])])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=ok), base_url="http://t") as client:
        assert await mcp_list_tools(client, {}) == ["t1"]
        with pytest.raises(AssertionError, match="initialize -> 404"):
            await mcp_list_tools(client, {}, path="/nope")


def test_mcp_message_rejects_sse_without_data():
    response = httpx.Response(200, headers={"content-type": "text/event-stream"}, text="event: ping\n\n")
    with pytest.raises(AssertionError, match="no data event"):
        testing._mcp_message(response)
