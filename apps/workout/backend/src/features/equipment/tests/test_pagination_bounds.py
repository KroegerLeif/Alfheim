import pytest
from httpx import AsyncClient

LIST_ENDPOINTS = ["/api/v1/equipment", "/api/v1/exercises", "/api/v1/plans", "/api/v1/sessions"]


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
@pytest.mark.parametrize("query", ["limit=201", "limit=0", "limit=-1", "offset=-1"])
async def test_list_endpoints_reject_out_of_range_pagination(client: AsyncClient, path: str, query: str):
    response = await client.get(f"{path}?{query}")
    assert response.status_code == 422


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
async def test_list_endpoints_accept_maximum_limit(client: AsyncClient, path: str):
    response = await client.get(f"{path}?limit=200&offset=0")
    assert response.status_code == 200
