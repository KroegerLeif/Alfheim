from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from uuid import UUID

from backend_shared.storage import S3StorageService, get_household_object_key
from fastapi import HTTPException, status
from src.features.transactions.models import (
    PresignedUploadResponse,
    QuickAddTransactionCreate,
    ReceiptLineItem,
    ReceiptOCRData,
    ReceiptOCRResponse,
    Transaction,
    TransactionCreate,
    TransactionType,
    TransactionUpdate,
)
from src.features.transactions.repository import TransactionRepository


class TransactionService:
    """Service handling business logic, S3 receipt storage, and OCR extraction."""

    def __init__(
        self,
        repository: TransactionRepository,
        storage_service: S3StorageService | None = None,
    ) -> None:
        self.repository = repository
        self.storage_service = storage_service or S3StorageService()

    async def create_transaction(
        self,
        household_id: UUID,
        transaction_in: TransactionCreate,
    ) -> Transaction:
        """Create a new manual transaction for the specified household."""
        return await self.repository.create(
            household_id=household_id,
            transaction_in=transaction_in,
            is_quick_add=False,
        )

    async def quick_add_transaction(
        self,
        household_id: UUID,
        quick_add_in: QuickAddTransactionCreate,
    ) -> Transaction:
        """Quickly add a transaction with minimal required fields."""
        return await self.repository.create(
            household_id=household_id,
            transaction_in=quick_add_in,
            is_quick_add=True,
        )

    async def get_transaction(self, transaction_id: UUID, household_id: UUID) -> Transaction:
        """Retrieve a transaction by ID, raising 404 if not found."""
        transaction = await self.repository.get_by_id(
            transaction_id=transaction_id,
            household_id=household_id,
        )
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        return transaction

    async def list_transactions(
        self,
        household_id: UUID,
        account_id: UUID | None = None,
        pot_id: UUID | None = None,
        plan_id: UUID | None = None,
        category_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Transaction]:
        """List transactions for a household with optional entity filters."""
        return await self.repository.list_by_household(
            household_id=household_id,
            account_id=account_id,
            pot_id=pot_id,
            plan_id=plan_id,
            category_id=category_id,
            limit=limit,
            offset=offset,
        )

    async def update_transaction(
        self,
        transaction_id: UUID,
        household_id: UUID,
        transaction_update: TransactionUpdate,
    ) -> Transaction:
        """Update an existing transaction for the specified household."""
        transaction = await self.get_transaction(
            transaction_id=transaction_id,
            household_id=household_id,
        )
        return await self.repository.update(
            transaction=transaction,
            transaction_update=transaction_update,
        )

    async def delete_transaction(self, transaction_id: UUID, household_id: UUID) -> None:
        """Delete a transaction for the specified household."""
        transaction = await self.get_transaction(
            transaction_id=transaction_id,
            household_id=household_id,
        )
        await self.repository.delete(transaction=transaction)

    async def generate_receipt_upload_url(
        self,
        household_id: UUID,
        filename: str,
        content_type: str | None = "image/jpeg",
    ) -> PresignedUploadResponse:
        """Generate a tenant-isolated presigned upload URL for RustFS S3 receipt storage."""
        object_key = get_household_object_key(
            household_id=str(household_id),
            app_name="budget",
            filename=f"receipts/{filename}",
        )
        upload_url = await self.storage_service.generate_presigned_upload_url(
            object_key=object_key,
            expires_in=3600,
            content_type=content_type,
        )
        return PresignedUploadResponse(upload_url=upload_url, object_key=object_key)

    async def extract_receipt_ocr(
        self,
        household_id: UUID,
        object_key: str,
        raw_text: str | None = None,
    ) -> ReceiptOCRResponse:
        """Extract vendor, total, and line items split from receipt OCR payload."""
        ocr_data = self._parse_ocr_payload(raw_text=raw_text, object_key=object_key)
        suggested_tx: TransactionCreate | None = None

        if ocr_data.total_amount is not None:
            suggested_tx = TransactionCreate(
                description=ocr_data.vendor_name or "Receipt Purchase",
                amount=ocr_data.total_amount,
                transaction_type=TransactionType.EXPENSE,
                transaction_date=ocr_data.transaction_date or date.today(),
                receipt_url=object_key,
            )

        return ReceiptOCRResponse(
            ocr_data=ocr_data,
            suggested_transaction=suggested_tx,
        )

    def _parse_ocr_payload(self, raw_text: str | None, object_key: str) -> ReceiptOCRData:
        """Private helper function parsing OCR raw text or object metadata into structured ReceiptOCRData."""
        if not raw_text:
            # Fallback default simulated OCR response when raw_text is omitted
            return ReceiptOCRData(
                vendor_name="Supermarket Express",
                total_amount=Decimal("42.50"),
                transaction_date=date.today(),
                line_items=[
                    ReceiptLineItem(description="Groceries item 1", amount=Decimal("25.00"), category="Food"),
                    ReceiptLineItem(description="Groceries item 2", amount=Decimal("17.50"), category="Food"),
                ],
            )

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        vendor = lines[0] if lines else "Unknown Vendor"
        total_val: Decimal | None = None
        line_items: list[ReceiptLineItem] = []

        for line in lines[1:]:
            parts = line.rsplit(" ", 1)
            if len(parts) == 2:
                try:
                    amt = Decimal(parts[1].replace(",", ".").replace("$", "").replace("€", ""))
                    if "total" in line.lower() or "sum" in line.lower():
                        total_val = amt
                    else:
                        line_items.append(ReceiptLineItem(description=parts[0], amount=amt))
                except Exception:
                    continue

        if total_val is None and line_items:
            total_val = sum((item.amount for item in line_items), Decimal("0.00"))

        return ReceiptOCRData(
            vendor_name=vendor,
            total_amount=total_val or Decimal("0.00"),
            transaction_date=date.today(),
            line_items=line_items,
        )
