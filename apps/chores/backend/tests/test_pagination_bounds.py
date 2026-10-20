import uuid

import pytest
from httpx import AsyncClient

LIST_PATHS = ["/api/v1/chores/templates", f"/api/v1/chores/templates/{uuid.uuid4()}/timeline"]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", LIST_PATHS)
@pytest.mark.parametrize("query", ["limit=201", "limit=0", "limit=-1", "offset=-1"])
async def test_list_endpoints_reject_out_of_range_pagination(client: AsyncClient, auth_headers, path: str, query: str):
    response = await client.get(f"{path}?{query}", headers=auth_headers())
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_template_list_accepts_maximum_limit(client: AsyncClient, auth_headers):
    response = await client.get("/api/v1/chores/templates?limit=200&offset=0", headers=auth_headers())
    assert response.status_code == 200
