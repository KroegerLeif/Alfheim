from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.dependencies import TenantContext, get_current_tenant, get_db_session
from src.features.transactions.models import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    QuickAddTransactionCreate,
    ReceiptOCRRequest,
    ReceiptOCRResponse,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)
from src.features.transactions.repository import TransactionRepository
from src.features.transactions.service import TransactionService

router = APIRouter()


def get_transaction_service(
    session: AsyncSession = Depends(get_db_session),
) -> TransactionService:
    """Dependency helper to instantiate TransactionService with session repository."""
    repository = TransactionRepository(session)
    return TransactionService(repository)


@router.post("/", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_in: TransactionCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    """Create a new manual transaction for the active household."""
    tx = await service.create_transaction(
        household_id=tenant.household_id,
        transaction_in=transaction_in,
    )
    return TransactionRead.model_validate(tx)


@router.post("/quick-add", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def quick_add_transaction(
    quick_add_in: QuickAddTransactionCreate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    """Quick-add a transaction for the active household."""
    tx = await service.quick_add_transaction(
        household_id=tenant.household_id,
        quick_add_in=quick_add_in,
    )
    return TransactionRead.model_validate(tx)


@router.get("/", response_model=list[TransactionRead])
async def list_transactions(
    account_id: UUID | None = Query(default=None),
    pot_id: UUID | None = Query(default=None),
    plan_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> Sequence[TransactionRead]:
    """List transactions for the active household with optional entity filters."""
    transactions = await service.list_transactions(
        household_id=tenant.household_id,
        account_id=account_id,
        pot_id=pot_id,
        plan_id=plan_id,
        category_id=category_id,
        limit=limit,
        offset=offset,
    )
    return [TransactionRead.model_validate(t) for t in transactions]


@router.post("/receipt/upload-url", response_model=PresignedUploadResponse)
async def generate_receipt_upload_url(
    upload_req: PresignedUploadRequest,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> PresignedUploadResponse:
    """Generate RustFS S3 presigned upload URL for receipt image attachment."""
    return await service.generate_receipt_upload_url(
        household_id=tenant.household_id,
        filename=upload_req.filename,
        content_type=upload_req.content_type,
    )


@router.post("/receipt/ocr", response_model=ReceiptOCRResponse)
async def extract_receipt_ocr(
    ocr_req: ReceiptOCRRequest,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> ReceiptOCRResponse:
    """Extract vendor, total, and line item split from receipt OCR payload."""
    return await service.extract_receipt_ocr(
        household_id=tenant.household_id,
        object_key=ocr_req.object_key,
        raw_text=ocr_req.raw_text,
    )


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(
    transaction_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    """Get transaction details by ID for active household."""
    tx = await service.get_transaction(
        transaction_id=transaction_id,
        household_id=tenant.household_id,
    )
    return TransactionRead.model_validate(tx)


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: UUID,
    transaction_update: TransactionUpdate,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionRead:
    """Update an existing transaction for active household."""
    tx = await service.update_transaction(
        transaction_id=transaction_id,
        household_id=tenant.household_id,
        transaction_update=transaction_update,
    )
    return TransactionRead.model_validate(tx)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    service: TransactionService = Depends(get_transaction_service),
) -> None:
    """Delete a transaction for active household."""
    await service.delete_transaction(
        transaction_id=transaction_id,
        household_id=tenant.household_id,
    )
