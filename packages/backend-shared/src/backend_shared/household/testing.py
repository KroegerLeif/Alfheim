"""Test helpers for apps using :mod:`backend_shared.household`.

Replace the old env-based mock-auth bypass with explicit overrides::

    from backend_shared.household.testing import make_test_token, override_membership

    def test_list_items(client, app):
        override_membership(app, {(HOUSEHOLD_ID, "user-1"): "OWNER"})
        headers = {"Authorization": f"Bearer {make_test_token('user-1')}", "X-Household-ID": str(HOUSEHOLD_ID)}
        assert client.get("/api/v1/items", headers=headers).status_code == 200

or skip authentication entirely with :func:`override_household`.
"""

import json
import uuid
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

import httpx
import jwt
from fastapi import FastAPI

from backend_shared.household import (
    HouseholdContext,
    HouseholdRole,
    derive_user_id,
    get_membership_lookup,
    normalize_memberships,
    require_household,
)

DEFAULT_TEST_HOUSEHOLD_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
DEFAULT_TEST_SUB = "test-user"


class StaticMembershipLookup:
    """In-memory :class:`~backend_shared.household.MembershipLookup` built from ``{(household_id, sub): role}``."""

    def __init__(self, memberships: Mapping[tuple[uuid.UUID | str, str], HouseholdRole] | None = None) -> None:
        self.memberships = normalize_memberships(memberships or {})
        self.calls: list[tuple[uuid.UUID, str]] = []

    def set(self, household_id: uuid.UUID | str, sub: str, role: HouseholdRole | None) -> None:
        """Add, change or (with ``role=None``) remove a membership."""
        hh = household_id if isinstance(household_id, uuid.UUID) else uuid.UUID(household_id)
        if role is None:
            self.memberships.pop((hh, sub), None)
        else:
            self.memberships.update(normalize_memberships({(hh, sub): role}))

    async def __call__(self, household_id: uuid.UUID, user_sub: str) -> HouseholdRole | None:
        self.calls.append((household_id, user_sub))
        return self.memberships.get((household_id, user_sub))


def override_membership(
    app: FastAPI, memberships: Mapping[tuple[uuid.UUID | str, str], HouseholdRole] | None = None
) -> StaticMembershipLookup:
    """Make ``require_household`` answer membership questions from ``memberships`` instead of the household app.

    JWTs are still decoded (unsigned tokens from :func:`make_test_token` are accepted
    in test contexts). Undo with ``app.dependency_overrides.clear()``.
    """
    lookup = StaticMembershipLookup(memberships)
    app.dependency_overrides[get_membership_lookup] = lambda: lookup
    return lookup


def make_household_context(
    *,
    household_id: uuid.UUID | str = DEFAULT_TEST_HOUSEHOLD_ID,
    sub: str = DEFAULT_TEST_SUB,
    role: HouseholdRole = "OWNER",
    email: str | None = None,
    username: str | None = None,
) -> HouseholdContext:
    """Build a :class:`HouseholdContext` with the same ``user_id`` derivation as production."""
    return HouseholdContext(
        user_sub=sub,
        user_id=derive_user_id(sub),
        household_id=household_id if isinstance(household_id, uuid.UUID) else uuid.UUID(household_id),
        role=role,
        email=email,
        username=username,
    )


def override_household(app: FastAPI, context: HouseholdContext | None = None, **kwargs: Any) -> HouseholdContext:
    """Bypass authentication: every ``require_household`` (and ``require_role``) sees ``context``.

    ``kwargs`` are forwarded to :func:`make_household_context` when ``context`` is omitted.
    """
    ctx = context if context is not None else make_household_context(**kwargs)
    app.dependency_overrides[require_household] = lambda: ctx
    return ctx


def make_test_token(sub: str = DEFAULT_TEST_SUB, **claims: Any) -> str:
    """Return an unsigned-verification test JWT; it only decodes when ``is_mock_auth_allowed()`` is true."""
    return jwt.encode({"sub": sub, **claims}, "backend-shared-test-secret-not-for-production", algorithm="HS256")


@contextmanager
def mcp_household_context(context: HouseholdContext | None = None, **kwargs: Any) -> Iterator[HouseholdContext]:
    """Set the MCP household context for calling tool functions directly in unit tests."""
    from backend_shared.mcp_middleware import mcp_household_context_var

    ctx = context if context is not None else make_household_context(**kwargs)
    token = mcp_household_context_var.set(ctx)
    try:
        yield ctx
    finally:
        mcp_household_context_var.reset(token)


@contextmanager
def mcp_membership(
    memberships: Mapping[tuple[uuid.UUID | str, str], HouseholdRole] | None = None,
) -> Iterator[StaticMembershipLookup]:
    """Make :class:`~backend_shared.mcp_middleware.MCPAuthenticationMiddleware` use ``memberships``.

    The MCP middleware sits outside FastAPI's dependency system, so
    :func:`override_membership` does not reach it; this swaps the shared client instead.
    """
    from backend_shared import mcp_middleware

    lookup = StaticMembershipLookup(memberships)
    with patch.object(mcp_middleware, "get_membership_client", return_value=lookup):
        yield lookup


MCP_TEST_PROTOCOL_VERSION = "2025-06-18"


def _mcp_message(response: httpx.Response) -> dict[str, Any]:
    """Decode a JSON-RPC message from a JSON or single-event SSE Streamable HTTP response."""
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        for line in response.text.splitlines():
            if line.startswith("data:"):
                return json.loads(line[len("data:") :])
        raise AssertionError(f"no data event in MCP SSE response: {response.text!r}")
    return response.json()


async def mcp_list_tools(client: httpx.AsyncClient, headers: Mapping[str, str], path: str = "/mcp") -> list[str]:
    """Run a real MCP ``initialize`` + ``notifications/initialized`` + ``tools/list`` handshake; return tool names.

    Raises:
        AssertionError: If any step does not answer with the expected status.
    """
    base = {**headers, "Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
    init = await client.post(
        path,
        headers=base,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_TEST_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "backend-shared-tests", "version": "0"},
            },
        },
    )
    assert init.status_code == 200, f"initialize -> {init.status_code}: {init.text}"
    assert "result" in _mcp_message(init), init.text

    session = {**base, "MCP-Protocol-Version": MCP_TEST_PROTOCOL_VERSION}
    if session_id := init.headers.get("mcp-session-id"):
        session["Mcp-Session-Id"] = session_id
    notified = await client.post(path, headers=session, json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert notified.status_code == 202, f"notifications/initialized -> {notified.status_code}: {notified.text}"

    listed = await client.post(path, headers=session, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert listed.status_code == 200, f"tools/list -> {listed.status_code}: {listed.text}"
    return [tool["name"] for tool in _mcp_message(listed)["result"]["tools"]]


__all__ = [
    "DEFAULT_TEST_HOUSEHOLD_ID",
    "DEFAULT_TEST_SUB",
    "MCP_TEST_PROTOCOL_VERSION",
    "StaticMembershipLookup",
    "make_household_context",
    "make_test_token",
    "mcp_household_context",
    "mcp_list_tools",
    "mcp_membership",
    "override_household",
    "override_membership",
]
