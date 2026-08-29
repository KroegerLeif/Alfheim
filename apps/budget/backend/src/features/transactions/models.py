from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class TransactionType(str, Enum):
    """Supported transaction types in the budget domain."""

    EXPENSE = "EXPENSE"
    INCOME = "INCOME"
    TRANSFER = "TRANSFER"


class ReceiptLineItem(BaseModel):
    """Individual line item parsed from a receipt."""

    description: str
    amount: Decimal
    category: str | None = None


class ReceiptOCRData(BaseModel):
    """Extracted payload from receipt OCR/AI analysis."""

    vendor_name: str | None = None
    total_amount: Decimal | None = None
    transaction_date: date | None = None
    line_items: list[ReceiptLineItem] = []


class TransactionBase(SQLModel):
    """Base SQLModel fields for Transaction entity."""

    description: str = Field(index=True)
    amount: Decimal = Field(decimal_places=2, max_digits=18)
    currency: str = Field(default="EUR", max_length=3)
    transaction_type: TransactionType = Field(default=TransactionType.EXPENSE, index=True)
    transaction_date: date = Field(default_factory=date.today)
    account_id: UUID | None = Field(default=None, foreign_key="accounts.id", index=True)
    pot_id: UUID | None = Field(default=None, foreign_key="pots.id", index=True)
    plan_id: UUID | None = Field(default=None, foreign_key="plans.id", index=True)
    category_id: UUID | None = Field(default=None, foreign_key="plan_categories.id", index=True)
    receipt_url: str | None = Field(default=None)
    is_quick_add: bool = Field(default=False)


class Transaction(TransactionBase, table=True):
    """Database model for financial transactions."""

    __tablename__ = "transactions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    household_id: UUID = Field(index=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TransactionCreate(TransactionBase):
    """Pydantic model for manual transaction creation request."""

    pass


class QuickAddTransactionCreate(BaseModel):
    """Pydantic model for quick-add transaction creation request."""

    description: str
    amount: Decimal
    transaction_type: TransactionType = TransactionType.EXPENSE
    currency: str = "EUR"
    transaction_date: date | None = None
    account_id: UUID | None = None
    pot_id: UUID | None = None
    plan_id: UUID | None = None
    category_id: UUID | None = None
    receipt_url: str | None = None


class TransactionUpdate(BaseModel):
    """Pydantic model for updating transaction details."""

    description: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    transaction_type: TransactionType | None = None
    transaction_date: date | None = None
    account_id: UUID | None = None
    pot_id: UUID | None = None
    plan_id: UUID | None = None
    category_id: UUID | None = None
    receipt_url: str | None = None
    is_quick_add: bool | None = None


class TransactionRead(TransactionBase):
    """Pydantic model for transaction response."""

    id: UUID
    household_id: UUID
    created_at: datetime
    updated_at: datetime


class PresignedUploadRequest(BaseModel):
    """Request payload to obtain an S3 presigned upload URL for receipt images."""

    filename: str
    content_type: str | None = "image/jpeg"


class PresignedUploadResponse(BaseModel):
    """Response payload containing S3 upload URL and object key."""

    upload_url: str
    object_key: str


class ReceiptOCRRequest(BaseModel):
    """Request payload for processing receipt OCR payload."""

    object_key: str
    raw_text: str | None = None


class ReceiptOCRResponse(BaseModel):
    """Extracted receipt OCR payload response with transaction suggestions."""

    ocr_data: ReceiptOCRData
    suggested_transaction: TransactionCreate | None = None
