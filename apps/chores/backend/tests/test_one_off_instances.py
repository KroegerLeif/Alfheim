"""POST /api/v1/chores/instances: one-off instances, idempotency and service principals (#958, #959)."""

import uuid
from datetime import date, timedelta

import pytest
from backend_shared.household import MembershipServiceError, derive_user_id, get_member_directory
from backend_shared.household.testing import StaticMembershipLookup
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.models import ChoreTemplate
from src.main import app
from tests.conftest import TEST_HOUSEHOLD_ID, _auth_headers

URL = "/api/v1/chores/instances"
PRINCIPAL = "integrations-principal"
SCOPE = "chores:create_instance"
OTHER_HOUSEHOLD = uuid.UUID("00000000-0000-0000-0000-0000000000f2")
MEMBER_SUB = "member-sub"


class BrokenDirectory:
    """Member directory whose household app is down."""

    async def list_members(self, household_id: uuid.UUID):
        raise MembershipServiceError("membership API unreachable")


async def _template(client: AsyncClient, name: str = "Unload washer") -> str:
    created = await client.post("/api/v1/chores/templates", json={"name": name, "points": 5})
    assert created.status_code == 201
    return created.json()["id"]


async def _foreign_template(db_session: AsyncSession) -> str:
    template = ChoreTemplate(name="Foreign", home_id=OTHER_HOUSEHOLD, points=1)
    db_session.add(template)
    await db_session.commit()
    return str(template.id)


@pytest.mark.asyncio
async def test_member_creates_an_instance(client: AsyncClient):
    template_id = await _template(client)
    due = (date.today() + timedelta(days=2)).isoformat()

    response = await client.post(URL, json={"template_id": template_id, "due_at": due})

    assert response.status_code == 201
    body = response.json()
    assert body["template_id"] == template_id
    assert body["due_date"] == due
    assert body["status"] == "pending"
    assert body["is_one_off"] is True
    assert body["assigned_to"] is None


@pytest.mark.asyncio
async def test_repeat_with_the_same_key_returns_the_instance(client: AsyncClient):
    template_id = await _template(client)
    headers = {"Idempotency-Key": "ha-event-42"}

    first = await client.post(URL, json={"template_id": template_id}, headers=headers)
    second = await client.post(URL, json={"template_id": template_id}, headers=headers)
    other = await client.post(URL, json={"template_id": await _template(client, "Other")}, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert other.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("key", ["", "has space", "x" * 201])
async def test_malformed_idempotency_key_is_rejected(client: AsyncClient, key: str):
    response = await client.post(URL, json={"template_id": str(uuid.uuid4())}, headers={"Idempotency-Key": key})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_template_of_another_household_is_not_found(client: AsyncClient, db_session: AsyncSession):
    response = await client.post(URL, json={"template_id": await _foreign_template(db_session)})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_one_off_does_not_replace_the_scheduled_instance(client: AsyncClient):
    template_id = await _template(client)
    created = await client.post(URL, json={"template_id": template_id})

    today = (await client.get("/api/v1/chores/today")).json()

    mine = [i for i in today if i["template_id"] == template_id]
    assert len(mine) == 2
    assert {i["is_one_off"] for i in mine} == {True, False}
    assert created.json()["id"] in {i["id"] for i in mine}


@pytest.mark.asyncio
async def test_service_principal_with_scope_creates_an_instance(
    client: AsyncClient, membership: StaticMembershipLookup
):
    template_id = await _template(client)
    membership.set(TEST_HOUSEHOLD_ID, MEMBER_SUB, "MEMBER")
    membership.grant_service(TEST_HOUSEHOLD_ID, PRINCIPAL, [SCOPE])
    payload = {"template_id": template_id, "assignee_id": str(derive_user_id(MEMBER_SUB))}

    response = await client.post(URL, json=payload, headers=_auth_headers(PRINCIPAL))

    assert response.status_code == 201
    assert response.json()["assigned_to"] == str(derive_user_id(MEMBER_SUB))


@pytest.mark.asyncio
async def test_service_principal_is_rejected_without_scope_elsewhere_and_after_revoke(
    client: AsyncClient, membership: StaticMembershipLookup
):
    template_id = await _template(client)
    principal = _auth_headers(PRINCIPAL)

    membership.grant_service(TEST_HOUSEHOLD_ID, PRINCIPAL, ["pantry:add_item"])
    assert (await client.post(URL, json={"template_id": template_id}, headers=principal)).status_code == 403

    membership.grant_service(TEST_HOUSEHOLD_ID, PRINCIPAL, [SCOPE])
    assert (await client.get("/api/v1/chores/templates", headers=principal)).status_code == 403
    other = _auth_headers(PRINCIPAL, OTHER_HOUSEHOLD)
    assert (await client.post(URL, json={"template_id": template_id}, headers=other)).status_code == 403
    assert (await client.post(URL, json={"template_id": template_id}, headers=principal)).status_code == 201

    membership.grant_service(TEST_HOUSEHOLD_ID, PRINCIPAL, None)
    assert (await client.post(URL, json={"template_id": template_id}, headers=principal)).status_code == 403


@pytest.mark.asyncio
async def test_assignee_rules(client: AsyncClient, membership: StaticMembershipLookup):
    template_id = await _template(client)
    membership.set(TEST_HOUSEHOLD_ID, MEMBER_SUB, "MEMBER")
    membership.set(TEST_HOUSEHOLD_ID, "guest-sub", "GUEST")
    member = _auth_headers(MEMBER_SUB)

    def body(sub: str) -> dict[str, str]:
        return {"template_id": template_id, "assignee_id": str(derive_user_id(sub))}

    assert (await client.post(URL, json=body(MEMBER_SUB), headers=member)).status_code == 201
    assert (await client.post(URL, json=body("guest-sub"), headers=member)).status_code == 403
    assert (await client.post(URL, json=body("guest-sub"))).status_code == 422
    assert (await client.post(URL, json=body("stranger"))).status_code == 404
    assert (
        await client.post(URL, json={"template_id": template_id}, headers=_auth_headers("guest-sub"))
    ).status_code == 403


@pytest.mark.asyncio
async def test_member_directory_outage_is_503(client: AsyncClient, membership: StaticMembershipLookup):
    template_id = await _template(client)
    app.dependency_overrides[get_member_directory] = BrokenDirectory
    response = await client.post(URL, json={"template_id": template_id, "assignee_id": str(uuid.uuid4())})
    assert response.status_code == 503
