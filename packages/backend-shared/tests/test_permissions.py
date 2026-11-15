"""Tests for the shared household role matrix (``backend_shared.household.permissions``)."""

import uuid

import pytest
from backend_shared.household import HouseholdContext, HouseholdRole
from backend_shared.household.permissions import ADMIN_ROLES, WRITE_ROLES, require_admin, require_writer
from backend_shared.household.testing import make_test_token, override_membership
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

HOUSEHOLD = uuid.UUID("11111111-2222-3333-4444-555555555555")
SUB = "301234567890123456"


def _client(role: HouseholdRole | None) -> TestClient:
    app = FastAPI()

    @app.post("/write")
    async def write(context: HouseholdContext = Depends(require_writer)) -> dict[str, str]:
        return {"role": context.role}

    @app.delete("/admin")
    async def admin(context: HouseholdContext = Depends(require_admin)) -> dict[str, str]:
        return {"role": context.role}

    override_membership(app, {(HOUSEHOLD, SUB): role} if role else {})
    return TestClient(app)


def _headers(**claims: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_test_token(SUB, **claims)}", "X-Household-ID": str(HOUSEHOLD)}


def test_role_tuples_keep_guest_read_only() -> None:
    assert WRITE_ROLES == ("OWNER", "ADMIN", "MEMBER")
    assert ADMIN_ROLES == ("OWNER", "ADMIN")


@pytest.mark.parametrize(
    ("role", "write", "admin"),
    [("OWNER", 200, 200), ("ADMIN", 200, 200), ("MEMBER", 200, 403), ("GUEST", 403, 403)],
)
def test_role_matrix(role: HouseholdRole, write: int, admin: int) -> None:
    client = _client(role)

    write_response = client.post("/write", headers=_headers())
    admin_response = client.delete("/admin", headers=_headers())

    assert write_response.status_code == write
    assert admin_response.status_code == admin
    for response in (write_response, admin_response):
        if response.status_code == 403:
            assert response.json()["detail"]["code"] == "household_role_forbidden"


def test_role_claims_in_the_token_are_ignored() -> None:
    client = _client("GUEST")

    response = client.delete("/admin", headers=_headers(role="OWNER", household_role="OWNER"))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_role_forbidden"


def test_non_member_is_forbidden_before_the_role_check() -> None:
    response = _client(None).post("/write", headers=_headers())

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "household_forbidden"
