import io
import re
from collections.abc import Iterator
from decimal import Decimal
from typing import cast
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from backend_shared.storage import S3StorageService
from httpx import AsyncClient
from PIL import Image
from pillow_heif import register_heif_opener
from src.core.config import settings
from src.features.transactions.models import TransactionType
from src.features.transactions.repository import TransactionRepository
from src.features.transactions.router import get_transaction_service
from src.features.transactions.service import TransactionService
from tests.helpers import create_auth_headers

register_heif_opener()


@pytest.mark.asyncio
async def test_manual_booking_and_crud(client: AsyncClient):
    """Test manual transaction booking, retrieval, updating, and deletion."""
    headers = create_auth_headers()

    # 1. Create transaction
    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Weekly Grocery Shopping",
            "amount": "85.40",
            "currency": "EUR",
            "transaction_type": TransactionType.EXPENSE,
            "transaction_date": "2025-05-10",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Weekly Grocery Shopping"
    assert Decimal(data["amount"]) == Decimal("85.40")
    assert data["transaction_type"] == "EXPENSE"
    assert data["is_quick_add"] is False
    tx_id = data["id"]

    # 2. Get transaction by ID
    resp_get = await client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["id"] == tx_id

    # 3. Update transaction
    resp_patch = await client.patch(
        f"/api/v1/transactions/{tx_id}",
        headers=headers,
        json={"amount": "92.00", "description": "Weekly Grocery Shopping + Snacks"},
    )
    assert resp_patch.status_code == 200
    assert Decimal(resp_patch.json()["amount"]) == Decimal("92.00")
    assert resp_patch.json()["description"] == "Weekly Grocery Shopping + Snacks"

    # 4. Delete transaction
    resp_del = await client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert resp_del.status_code == 204

    # 5. Verify 404 after deletion
    resp_get_deleted = await client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert resp_get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_quick_add_transaction(client: AsyncClient):
    """Test quick-add transaction endpoint."""
    headers = create_auth_headers()

    resp = await client.post(
        "/api/v1/transactions/quick-add",
        headers=headers,
        json={
            "description": "Coffee on the go",
            "amount": "4.50",
            "transaction_type": TransactionType.EXPENSE,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Coffee on the go"
    assert Decimal(data["amount"]) == Decimal("4.50")
    assert data["is_quick_add"] is True


@pytest.mark.asyncio
async def test_tenant_isolation_and_filtering(client: AsyncClient):
    """Test strict tenant isolation and list query filters."""
    headers_a = create_auth_headers()
    headers_b = create_auth_headers()

    acc_resp = await client.post(
        "/api/v1/accounts/", headers=headers_a, json={"name": "A Checking", "account_type": "CHECKING"}
    )
    assert acc_resp.status_code == 201
    acc_id = acc_resp.json()["id"]
    pot_resp = await client.post("/api/v1/pots/", headers=headers_a, json={"name": "A Pot", "priority": 1})
    assert pot_resp.status_code == 201
    pot_id = pot_resp.json()["id"]

    # Create 2 transactions for Household A (1 with account_id and pot_id)
    resp_a1 = await client.post(
        "/api/v1/transactions/",
        headers=headers_a,
        json={
            "description": "Salary Deposit",
            "amount": "3500.00",
            "transaction_type": TransactionType.INCOME,
            "account_id": acc_id,
        },
    )
    assert resp_a1.status_code == 201
    tx_a1_id = resp_a1.json()["id"]

    resp_a2 = await client.post(
        "/api/v1/transactions/",
        headers=headers_a,
        json={
            "description": "Emergency Repair",
            "amount": "250.00",
            "transaction_type": TransactionType.EXPENSE,
            "pot_id": pot_id,
        },
    )
    assert resp_a2.status_code == 201

    # Household B attempts to get Household A's transaction -> 404
    resp_b_get = await client.get(f"/api/v1/transactions/{tx_a1_id}", headers=headers_b)
    assert resp_b_get.status_code == 404

    # Household B listing returns empty list
    resp_b_list = await client.get("/api/v1/transactions/", headers=headers_b)
    assert resp_b_list.status_code == 200
    assert len(resp_b_list.json()) == 0

    # Household A listing with account filter
    resp_a_acc = await client.get(f"/api/v1/transactions/?account_id={acc_id}", headers=headers_a)
    assert resp_a_acc.status_code == 200
    acc_txs = resp_a_acc.json()
    assert len(acc_txs) == 1
    assert acc_txs[0]["id"] == tx_a1_id

    # Household A listing with pot filter
    resp_a_pot = await client.get(f"/api/v1/transactions/?pot_id={pot_id}", headers=headers_a)
    assert resp_a_pot.status_code == 200
    pot_txs = resp_a_pot.json()
    assert len(pot_txs) == 1
    assert Decimal(pot_txs[0]["amount"]) == Decimal("250.00")


class FakeStorage:
    """Records objects instead of talking to S3."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    async def put_object(self, object_key: str, body: bytes, content_type: str) -> None:
        self.objects[object_key] = (body, content_type)


@pytest.fixture
def storage(client: AsyncClient) -> Iterator[FakeStorage]:
    fake = FakeStorage()
    app = client._transport.app  # ty: ignore[unresolved-attribute]
    app.dependency_overrides[get_transaction_service] = lambda: TransactionService(
        MagicMock(spec=TransactionRepository),
        storage_service=cast(S3StorageService, fake),
    )
    yield fake
    app.dependency_overrides.pop(get_transaction_service, None)


def _image_bytes(fmt: str, size=(3000, 2000)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (30, 120, 60)).save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "content", "mime"),
    [
        ("receipt.jpg", _image_bytes("JPEG"), "image/jpeg"),
        ("receipt.png", _image_bytes("PNG"), "image/png"),
        ("receipt.webp", _image_bytes("WEBP"), "image/webp"),
        ("receipt.heic", _image_bytes("HEIF"), "image/heic"),
    ],
)
async def test_receipt_images_are_stored_as_webp(client: AsyncClient, storage: FakeStorage, name, content, mime):
    headers = create_auth_headers()
    resp = await client.post("/api/v1/transactions/receipt", headers=headers, files={"file": (name, content, mime)})
    assert resp.status_code == 201
    key = resp.json()["object_key"]
    assert key.endswith(".webp") and "/budget/receipts/" in key and name not in key
    body, content_type = storage.objects[key]
    assert content_type == "image/webp"
    assert Image.open(io.BytesIO(body)).format == "WEBP"
    assert max(Image.open(io.BytesIO(body)).size) <= 2560


@pytest.mark.asyncio
async def test_receipt_pdf_is_stored_unchanged(client: AsyncClient, storage: FakeStorage):
    headers = create_auth_headers()
    pdf = b"%PDF-1.4\n%fake"
    resp = await client.post(
        "/api/v1/transactions/receipt", headers=headers, files={"file": ("a.pdf", pdf, "application/pdf")}
    )
    assert resp.status_code == 201
    key = resp.json()["object_key"]
    assert key.endswith(".pdf")
    assert storage.objects[key] == (pdf, "application/pdf")


@pytest.mark.asyncio
async def test_receipt_key_is_server_generated_and_tenant_scoped(client: AsyncClient, storage: FakeStorage):
    household_id = str(uuid4())
    headers = create_auth_headers(household_id=household_id)
    hostile = "../../households/other/budget/receipts/x.jpg"
    resp = await client.post(
        "/api/v1/transactions/receipt",
        headers=headers,
        files={"file": (hostile, _image_bytes("PNG", (50, 50)), "image/png")},
    )
    assert resp.status_code == 201
    key = resp.json()["object_key"]
    assert re.fullmatch(rf"households/{household_id}/budget/receipts/[0-9a-f]{{32}}\.webp", key)


@pytest.mark.asyncio
async def test_receipt_content_not_header_decides_type(client: AsyncClient, storage: FakeStorage):
    headers = create_auth_headers()
    resp = await client.post(
        "/api/v1/transactions/receipt",
        headers=headers,
        files={"file": ("receipt.jpg", b"<html>hi</html>", "image/jpeg")},
    )
    assert resp.status_code == 400
    assert not storage.objects


@pytest.mark.asyncio
async def test_receipt_corrupt_image_is_400(client: AsyncClient, storage: FakeStorage):
    headers = create_auth_headers()
    resp = await client.post(
        "/api/v1/transactions/receipt",
        headers=headers,
        files={"file": ("r.jpg", b"\xff\xd8\xff garbage", "image/jpeg")},
    )
    assert resp.status_code == 400
    assert not storage.objects


@pytest.mark.asyncio
async def test_receipt_over_limit_is_413(client: AsyncClient, storage: FakeStorage, monkeypatch):
    monkeypatch.setattr(settings, "MAX_RECEIPT_UPLOAD_BYTES", 1024)
    headers = create_auth_headers()
    resp = await client.post(
        "/api/v1/transactions/receipt",
        headers=headers,
        files={"file": ("big.pdf", b"%PDF-1.4" + b"0" * 5000, "application/pdf")},
    )
    assert resp.status_code == 413
    assert not storage.objects


@pytest.mark.asyncio
async def test_receipt_upload_requires_writer(client: AsyncClient, storage: FakeStorage):
    headers = create_auth_headers(role="GUEST")
    resp = await client.post(
        "/api/v1/transactions/receipt", headers=headers, files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_presigned_upload_endpoint_is_gone(client: AsyncClient):
    headers = create_auth_headers()
    resp = await client.post("/api/v1/transactions/receipt/upload-url", headers=headers, json={"filename": "a.jpg"})
    assert resp.status_code in (404, 405)


@pytest.mark.asyncio
async def test_receipt_ocr(client: AsyncClient):
    """Test receipt OCR payload processing from caller-supplied text."""
    headers = create_auth_headers()
    url_data = {"object_key": "households/h/budget/receipts/abc.webp"}

    # 2. Extract OCR with raw text
    raw_ocr_text = "Supermarket Bio Markt\nOrganic Milk 2.49\nFresh Apples 3.50\nTotal 5.99"
    resp_ocr = await client.post(
        "/api/v1/transactions/receipt/ocr",
        headers=headers,
        json={"object_key": url_data["object_key"], "raw_text": raw_ocr_text},
    )
    assert resp_ocr.status_code == 200
    ocr_payload = resp_ocr.json()
    assert ocr_payload["ocr_data"]["vendor_name"] == "Supermarket Bio Markt"
    assert Decimal(str(ocr_payload["ocr_data"]["total_amount"])) == Decimal("5.99")
    assert len(ocr_payload["ocr_data"]["line_items"]) == 2
    assert ocr_payload["suggested_transaction"]["description"] == "Supermarket Bio Markt"
    assert Decimal(str(ocr_payload["suggested_transaction"]["amount"])) == Decimal("5.99")

    # 3. Without raw_text there is no OCR/vision provider to derive real data from the image,
    # so the endpoint must not fabricate a result -- it returns 501 instead.
    resp_ocr_fallback = await client.post(
        "/api/v1/transactions/receipt/ocr",
        headers=headers,
        json={"object_key": url_data["object_key"]},
    )
    assert resp_ocr_fallback.status_code == 501
    detail = resp_ocr_fallback.json()["detail"]
    assert "not implemented" in detail.lower()
    assert "42.50" not in detail
    assert "Supermarket Express" not in detail
