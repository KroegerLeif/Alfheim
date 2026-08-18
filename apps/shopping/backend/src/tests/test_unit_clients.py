from unittest.mock import MagicMock, patch

import pytest
from src.core.exceptions import PantryServiceError
from src.features.shopping_lists.clients.open_food_facts import OpenFoodFactsClient
from src.features.shopping_lists.clients.pantry_client import PantryClient


@pytest.mark.asyncio
async def test_pantry_client_fetch_low_stock_success():
    client = PantryClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"product": {"id": "00000000-0000-0000-0000-000000000123", "name": "Milk"}}]

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        items = await client.fetch_low_stock_items(token="Bearer token", household_id=None)
        assert len(items) == 1
        assert items[0]["product"]["name"] == "Milk"


@pytest.mark.asyncio
async def test_pantry_client_fetch_low_stock_error():
    client = PantryClient()
    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        with pytest.raises(PantryServiceError):
            await client.fetch_low_stock_items()


@pytest.mark.asyncio
async def test_pantry_client_bulk_add_success():
    client = PantryClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"successful_items": [], "unrecognized_items": []}

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        res = await client.bulk_add_items(items=[])
        assert "successful_items" in res


@pytest.mark.asyncio
async def test_pantry_client_bulk_add_error():
    client = PantryClient()
    mock_response = MagicMock()
    mock_response.status_code = 400

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        with pytest.raises(PantryServiceError):
            await client.bulk_add_items(items=[])


@pytest.mark.asyncio
async def test_open_food_facts_client_success():
    client = OpenFoodFactsClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": 1,
        "product": {
            "product_name": "Nutella",
            "brands": "Ferrero, Other",
            "image_front_url": "https://example.com/nutella.jpg",
        },
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        product = await client.get_by_barcode("3017620422003")
        assert product is not None
        assert product["name"] == "Nutella"
        assert product["brand"] == "Ferrero"
        assert product["image_url"] == "https://example.com/nutella.jpg"


@pytest.mark.asyncio
async def test_open_food_facts_client_not_found():
    client = OpenFoodFactsClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": 0}

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        product = await client.get_by_barcode("0000000000000")
        assert product is None
