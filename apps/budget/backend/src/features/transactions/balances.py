"""Helpers keeping Account.balance and Pot.current_amount in sync with the transaction ledger.

Transactions are the single source of truth for money movement: every create/update/delete
of a Transaction with a linked account_id and/or pot_id atomically adjusts that account's
`balance` and/or that pot's `current_amount` by a signed delta derived from the transaction's
`transaction_type`. Updates are issued as a single `UPDATE ... SET balance = balance + :delta`
statement (not a Python read-modify-write) so concurrent writers can never lose an update to a
stale in-process read -- the database serializes the increments.
"""

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlmodel import col, update
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.accounts.models import Account
from src.features.pots.models import Pot
from src.features.transactions.models import Transaction, TransactionType

TWO_PLACES = Decimal("0.01")


def quantize_amount(amount: Decimal) -> Decimal:
    """Round a monetary amount to 2 decimal places using half-up rounding."""
    return Decimal(amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def signed_deltas(transaction_type: TransactionType, amount: Decimal) -> tuple[Decimal, Decimal]:
    """Return the (account_delta, pot_delta) implied by a transaction's type and magnitude.

    `Transaction.amount` is always stored as a positive magnitude (see issue #536); the sign
    applied to each linked balance is derived here from `transaction_type`, never from the
    stored sign of `amount`.

    - EXPENSE: money leaves whatever it's booked against (account and/or pot both decrease).
    - INCOME: money enters whatever it's booked against (account and/or pot both increase).
    - TRANSFER: the account is treated as the source (decreases) and the pot as the
      destination (increases) -- this matches the Quick-Add UI, where the pot field is
      labelled "target pot". A TRANSFER booked against only one side simply moves money
      into/out of the tracked ledger on that side.
    """
    magnitude = quantize_amount(amount)
    if transaction_type == TransactionType.EXPENSE:
        return -magnitude, -magnitude
    if transaction_type == TransactionType.INCOME:
        return magnitude, magnitude
    # TRANSFER
    return -magnitude, magnitude


def deltas_for_transaction(transaction: Transaction) -> tuple[Decimal, Decimal]:
    """Compute the (account_delta, pot_delta) a given transaction currently contributes."""
    return signed_deltas(transaction.transaction_type, transaction.amount)


async def apply_balance_deltas(
    session: AsyncSession,
    account_id: UUID | None,
    pot_id: UUID | None,
    account_delta: Decimal,
    pot_delta: Decimal,
) -> None:
    """Atomically adjust Account.balance / Pot.current_amount by the given deltas.

    Each adjustment is a single `UPDATE ... SET col = col + :delta` statement executed within
    the caller's current DB transaction, so it is applied atomically alongside the ledger
    write (insert/update/delete) that triggered it, and is safe under concurrent writers.
    """
    if account_id is not None and account_delta != Decimal("0.00"):
        await session.exec(
            update(Account).where(col(Account.id) == account_id).values(balance=Account.balance + account_delta)
        )
    if pot_id is not None and pot_delta != Decimal("0.00"):
        await session.exec(
            update(Pot).where(col(Pot.id) == pot_id).values(current_amount=Pot.current_amount + pot_delta)
        )


async def apply_transaction_effect(session: AsyncSession, transaction: Transaction) -> None:
    """Apply the balance effect of `transaction` as currently stored (used on create)."""
    account_delta, pot_delta = deltas_for_transaction(transaction)
    await apply_balance_deltas(
        session=session,
        account_id=transaction.account_id,
        pot_id=transaction.pot_id,
        account_delta=account_delta,
        pot_delta=pot_delta,
    )


async def reverse_transaction_effect(session: AsyncSession, transaction: Transaction) -> None:
    """Undo the balance effect of `transaction` as currently stored (used on update/delete)."""
    account_delta, pot_delta = deltas_for_transaction(transaction)
    await apply_balance_deltas(
        session=session,
        account_id=transaction.account_id,
        pot_id=transaction.pot_id,
        account_delta=-account_delta,
        pot_delta=-pot_delta,
    )
