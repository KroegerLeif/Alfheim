from decimal import Decimal
from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient
from src.features.transactions.models import TransactionType


def create_auth_headers(
    user_id: str | None = None,
    household_id: str | None = None,
) -> dict[str, str]:
    """Helper to generate JWT bearer authorization and X-Household-ID headers."""
    uid = user_id or str(uuid4())
    hid = household_id or str(uuid4())
    payload = {
        "sub": uid,
        "household_id": hid,
    }
    token = jwt.encode(payload, "secret", algorithm="HS256")
    return {
        "Authorization": f"Bearer {token}",
        "X-Household-ID": hid,
    }


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

    acc_id = str(uuid4())
    pot_id = str(uuid4())

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


@pytest.mark.asyncio
async def test_receipt_presigned_url_and_ocr(client: AsyncClient):
    """Test RustFS S3 presigned URL generation and receipt OCR payload processing."""
    headers = create_auth_headers()

    # 1. Generate presigned upload URL
    resp_url = await client.post(
        "/api/v1/transactions/receipt/upload-url",
        headers=headers,
        json={"filename": "store_receipt.jpg", "content_type": "image/jpeg"},
    )
    assert resp_url.status_code == 200
    url_data = resp_url.json()
    assert "upload_url" in url_data
    assert "object_key" in url_data
    assert "receipts/store_receipt.jpg" in url_data["object_key"]

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

    # 3. Extract OCR fallback without raw text
    resp_ocr_fallback = await client.post(
        "/api/v1/transactions/receipt/ocr",
        headers=headers,
        json={"object_key": url_data["object_key"]},
    )
    assert resp_ocr_fallback.status_code == 200
    fallback_payload = resp_ocr_fallback.json()
    assert fallback_payload["ocr_data"]["vendor_name"] == "Supermarket Express"
    assert Decimal(str(fallback_payload["ocr_data"]["total_amount"])) == Decimal("42.50")
