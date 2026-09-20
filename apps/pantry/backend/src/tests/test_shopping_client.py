import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from src.core.shopping_client import push_out_of_stock_to_shopping

HOUSEHOLD = uuid.UUID("00000000-0000-0000-0000-0000000000c1")


async def test_push_forwards_caller_token_and_household():
    response = MagicMock(status_code=201)
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response) as post:
        ok = await push_out_of_stock_to_shopping("http://shopping/", "raw-token", HOUSEHOLD, name="Milk")
    assert ok is True
    assert post.call_args.kwargs["headers"] == {"X-Household-ID": str(HOUSEHOLD), "Authorization": "Bearer raw-token"}
    assert post.call_args.args[0] == "http://shopping/api/v1/shopping/items"


async def test_push_keeps_existing_bearer_prefix_and_reports_rejection():
    response = MagicMock(status_code=403, text="household_forbidden")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=response) as post:
        ok = await push_out_of_stock_to_shopping("http://shopping", "Bearer abc", HOUSEHOLD, name="Milk")
    assert ok is False
    assert post.call_args.kwargs["headers"]["Authorization"] == "Bearer abc"


async def test_push_handles_network_errors():
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.ConnectError("down")):
        assert await push_out_of_stock_to_shopping("http://shopping", "t", HOUSEHOLD, name="Milk") is False
