import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import Request
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.config import Settings
from src.core.dependencies import (
    MOCK_HOME_ID,
    MOCK_USER_ID,
    decode_keycloak_token,
    get_jwks_client,
    is_mock_auth_allowed,
)
from src.core.exceptions import (
    ShoppingError,
    ShoppingItemNotFoundError,
    ShoppingListNotFoundError,
    ShoppingListProtectedError,
)
from src.features.shopping_lists.schemas import (
    PushItemPayload,
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingListCreate,
)
from src.features.shopping_lists.services.list_management_service import ListManagementService
from src.features.shopping_lists.services.shopping_item_service import ShoppingItemService
from src.main import shopping_error_handler, value_error_exception_handler


def test_settings_properties():
    """Verify Settings property accessors for Keycloak JWKS and Issuer URLs."""
    s1 = Settings(KEYCLOAK_JWKS_URL="http://custom/jwks")
    assert s1.jwks_url == "http://custom/jwks"

    s2 = Settings(
        KEYCLOAK_URL="http://keycloak:8080/auth/",
        KEYCLOAK_PUBLIC_URL="http://public.auth/realm/",
        KEYCLOAK_REALM="alfheim",
        KEYCLOAK_JWKS_URL="",
    )
    assert s2.jwks_url == "http://keycloak:8080/auth/realms/alfheim/protocol/openid-connect/certs"
    assert s2.expected_issuer == "http://public.auth/realm/realms/alfheim"
    assert len(s2.jwks_fallback_urls) > 0


def test_core_dependency_wrappers():
    """Verify backend_shared dependency helper pass-throughs."""
    assert isinstance(is_mock_auth_allowed(), bool)
    with patch("backend_shared.dependencies.get_jwks_client") as mock_get_client:
        get_jwks_client("http://mock/jwks")
        mock_get_client.assert_called_once_with("http://mock/jwks")

    with patch("backend_shared.dependencies.decode_keycloak_token") as mock_decode:
        mock_decode.return_value = {"sub": "user-123"}
        payload = decode_keycloak_token("mock-token")
        assert payload["sub"] == "user-123"


@pytest.mark.asyncio
async def test_global_exception_handlers():
    """Verify custom error handlers in main.py."""
    req = MagicMock(spec=Request)

    # ShoppingError handler
    shop_err = ShoppingError("Test error", error_code="shopping.error.test")
    res1 = await shopping_error_handler(req, shop_err)
    assert res1.status_code == 400
    assert b"shopping.error.test" in res1.body

    # ValueError handler
    val_err = ValueError("Invalid argument")
    res2 = await value_error_exception_handler(req, val_err)
    assert res2.status_code == 400
    assert b"shopping.error.value_error" in res2.body


@pytest.mark.asyncio
async def test_list_management_service_edge_cases(db_session: AsyncSession):
    """Verify list provisioning, protected list deletion guards, and reordering."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    # 1. personal_list_name normalization
    assert "Personal" in ListManagementService.personal_list_name("NAVIGATION.profile", owner_id)
    assert "Liste" in ListManagementService.personal_list_name(None, owner_id)

    # 2. ensure_personal_list creation and name healing
    p_list = await ListManagementService.ensure_personal_list(db_session, home_id, owner_id, "User One")
    assert p_list.is_personal is True

    # Heal NAVIGATION name in existing personal list
    p_list.name = "NAVIGATION.old"
    db_session.add(p_list)
    await db_session.commit()
    healed = await ListManagementService.ensure_personal_list(db_session, home_id, owner_id, "User One")
    assert not healed.name.startswith("NAVIGATION.")

    # 3. ensure_household_list fallback to legacy Haushalt and name healing
    h_list = await ListManagementService.ensure_household_list(db_session, home_id, owner_id)
    assert h_list.is_default is True

    # 4. create_list with NAVIGATION in name
    custom = await ListManagementService.create_list(
        db_session,
        ShoppingListCreate(name="NAVIGATION_MY_LIST"),
        home_id,
        owner_id,
    )
    assert custom.name == "Custom List"

    # 5. get_list boundary checks
    with pytest.raises(ShoppingListNotFoundError):
        await ListManagementService.get_list(db_session, uuid.uuid4(), home_id)

    foreign_home = uuid.uuid4()
    with pytest.raises(ShoppingListNotFoundError):
        await ListManagementService.get_list(db_session, custom.id, foreign_home)

    # 6. delete_list protected checks
    with pytest.raises(ShoppingListProtectedError):
        await ListManagementService.delete_list(db_session, h_list.id, home_id)

    with pytest.raises(ShoppingListProtectedError):
        await ListManagementService.delete_list(db_session, p_list.id, home_id)

    # Delete custom list success
    assert await ListManagementService.delete_list(db_session, custom.id, home_id) is True

    # 7. reorder_lists
    c1 = await ListManagementService.create_list(db_session, ShoppingListCreate(name="C1"), home_id, owner_id)
    c2 = await ListManagementService.create_list(db_session, ShoppingListCreate(name="C2"), home_id, owner_id)
    assert await ListManagementService.reorder_lists(db_session, [c2.id, c1.id], home_id) is True


@pytest.mark.asyncio
async def test_get_lists_dashboard_token_and_fallback(db_session: AsyncSession):
    """Verify get_lists with token integration and error fallback."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    # Success fetching households from dashboard
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"id": str(home_id), "name": "Main Household"}]

    with patch("httpx.AsyncClient.get", AsyncMock(return_value=mock_resp)):
        lists = await ListManagementService.get_lists(
            db_session,
            home_id=home_id,
            owner_id=owner_id,
            token="Bearer valid-token",
        )
        assert len(lists) >= 2

    # Dashboard endpoint exception fallback
    with patch("httpx.AsyncClient.get", AsyncMock(side_effect=httpx.RequestError("Network down"))):
        lists_fallback = await ListManagementService.get_lists(
            db_session,
            home_id=home_id,
            owner_id=owner_id,
            token="Bearer valid-token",
        )
        assert len(lists_fallback) >= 2


@pytest.mark.asyncio
async def test_shopping_item_service_operations_and_errors(db_session: AsyncSession):
    """Verify ShoppingItemService CRUD operations, push fallbacks, and 404s."""
    home_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    # Provision household list
    h_list = await ListManagementService.ensure_household_list(db_session, home_id, owner_id)

    # 1. Add item
    item = await ShoppingItemService.add_item(
        db_session,
        h_list.id,
        ShoppingItemCreate(name="Butter", brand="Dairy", quantity=2.0, unit="pack"),
        home_id,
    )
    assert item.name == "Butter"

    # 2. Push item without list_id (routes to default household list)
    pushed1 = await ShoppingItemService.push_item(
        db_session,
        PushItemPayload(name="Eggs", quantity=10.0, unit="piece", product_id=uuid.uuid4()),
        home_id,
        owner_id,
    )
    assert pushed1.name == "Eggs"
    assert pushed1.list_id == h_list.id

    # 3. Update item success
    updated = await ShoppingItemService.update_item(
        db_session,
        h_list.id,
        item.id,
        ShoppingItemUpdate(name="Salted Butter", unit="piece"),
        home_id,
    )
    assert updated.name == "Salted Butter"
    assert updated.unit == "piece"

    # 4. Update item not found
    with pytest.raises(ShoppingItemNotFoundError):
        await ShoppingItemService.update_item(
            db_session,
            h_list.id,
            uuid.uuid4(),
            ShoppingItemUpdate(name="Missing"),
            home_id,
        )

    # 5. Delete item not found
    with pytest.raises(ShoppingItemNotFoundError):
        await ShoppingItemService.delete_item(db_session, h_list.id, uuid.uuid4(), home_id)

    # 6. Delete item success
    assert await ShoppingItemService.delete_item(db_session, h_list.id, item.id, home_id) is True


@pytest.mark.asyncio
async def test_router_households_and_delete_item_endpoint(client: AsyncClient, db_session: AsyncSession):
    """Verify /api/v1/shopping-lists/households proxy and router delete item."""
    # 1. Households endpoint proxying with mock response
    import jwt

    token = jwt.encode({"sub": str(MOCK_USER_ID)}, "secret", algorithm="HS256")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"id": str(MOCK_HOME_ID), "name": "Mock Home", "slug": "mock-home"}]

    mock_instance = AsyncMock()
    mock_instance.get = AsyncMock(return_value=mock_resp)
    with patch("src.features.shopping_lists.router.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__.return_value = mock_instance
        res = await client.get("/api/v1/households/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert len(res.json()) == 1

    # Households endpoint error fallback
    mock_err_instance = AsyncMock()
    mock_err_instance.get = AsyncMock(side_effect=httpx.RequestError("Failed"))
    with patch("src.features.shopping_lists.router.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__.return_value = mock_err_instance
        res2 = await client.get("/api/v1/households/me")
        assert res2.status_code == 200
        assert res2.json() == []

    # 2. Router delete item endpoint
    h_list = await ListManagementService.ensure_household_list(db_session, MOCK_HOME_ID, MOCK_USER_ID)
    item = await ShoppingItemService.add_item(
        db_session,
        h_list.id,
        ShoppingItemCreate(name="Juice", quantity=1.0, unit="l"),
        MOCK_HOME_ID,
    )

    del_res = await client.delete(f"/api/v1/shopping-lists/{h_list.id}/items/{item.id}")
    assert del_res.status_code == 204
