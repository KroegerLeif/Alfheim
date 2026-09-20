"""Tests asserting that transactions are the single source of truth for account/pot balances."""

from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.accounts.models import Account, AccountType
from src.features.pots.models import OverflowTarget
from src.features.transactions.models import TransactionType
from tests.helpers import create_auth_headers


async def _create_account(client: AsyncClient, headers: dict[str, str], balance: str = "1000.00") -> str:
    resp = await client.post(
        "/api/v1/accounts/",
        headers=headers,
        json={"name": "Main Checking", "account_type": AccountType.CHECKING, "balance": balance},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_pot(client: AsyncClient, headers: dict[str, str], current_amount: str = "0.00") -> str:
    resp = await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={"name": "Vacation", "priority": 1, "current_amount": current_amount},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _get_account_balance(client: AsyncClient, headers: dict[str, str], account_id: str) -> Decimal:
    resp = await client.get(f"/api/v1/accounts/{account_id}", headers=headers)
    assert resp.status_code == 200
    return Decimal(resp.json()["balance"])


async def _get_pot_amount(client: AsyncClient, headers: dict[str, str], pot_id: str) -> Decimal:
    resp = await client.get(f"/api/v1/pots/{pot_id}", headers=headers)
    assert resp.status_code == 200
    return Decimal(resp.json()["current_amount"])


@pytest.mark.asyncio
async def test_expense_transaction_decreases_account_balance(client: AsyncClient):
    """Logging an EXPENSE against an account should reduce its balance by the amount."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="1000.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Groceries",
            "amount": "200.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_id,
        },
    )
    assert resp.status_code == 201

    balance = await _get_account_balance(client, headers, account_id)
    assert balance == Decimal("800.00")


@pytest.mark.asyncio
async def test_income_transaction_increases_account_balance(client: AsyncClient):
    """Logging an INCOME transaction should increase the linked account's balance."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="1000.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Salary",
            "amount": "3000.00",
            "transaction_type": TransactionType.INCOME,
            "account_id": account_id,
        },
    )
    assert resp.status_code == 201

    balance = await _get_account_balance(client, headers, account_id)
    assert balance == Decimal("4000.00")


@pytest.mark.asyncio
async def test_expense_transaction_decreases_pot_amount(client: AsyncClient):
    """Logging an EXPENSE against a pot should reduce that pot's current_amount."""
    headers = create_auth_headers()
    pot_id = await _create_pot(client, headers, current_amount="500.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Car repair",
            "amount": "120.00",
            "transaction_type": TransactionType.EXPENSE,
            "pot_id": pot_id,
        },
    )
    assert resp.status_code == 201

    amount = await _get_pot_amount(client, headers, pot_id)
    assert amount == Decimal("380.00")


@pytest.mark.asyncio
async def test_transfer_moves_money_from_account_to_pot(client: AsyncClient):
    """A TRANSFER booked with both account_id and pot_id moves money account -> pot."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="1000.00")
    pot_id = await _create_pot(client, headers, current_amount="0.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Move to vacation pot",
            "amount": "300.00",
            "transaction_type": TransactionType.TRANSFER,
            "account_id": account_id,
            "pot_id": pot_id,
        },
    )
    assert resp.status_code == 201

    assert await _get_account_balance(client, headers, account_id) == Decimal("700.00")
    assert await _get_pot_amount(client, headers, pot_id) == Decimal("300.00")


@pytest.mark.asyncio
async def test_updating_transaction_amount_rebalances_account(client: AsyncClient):
    """Changing a transaction's amount after the fact adjusts the account by the delta only."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="1000.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Groceries",
            "amount": "200.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_id,
        },
    )
    tx_id = resp.json()["id"]
    assert await _get_account_balance(client, headers, account_id) == Decimal("800.00")

    resp_patch = await client.patch(
        f"/api/v1/transactions/{tx_id}",
        headers=headers,
        json={"amount": "250.00"},
    )
    assert resp_patch.status_code == 200
    assert await _get_account_balance(client, headers, account_id) == Decimal("750.00")


@pytest.mark.asyncio
async def test_updating_transaction_account_moves_effect_between_accounts(client: AsyncClient):
    """Re-pointing a transaction to a different account undoes the old effect and applies the new one."""
    headers = create_auth_headers()
    account_a = await _create_account(client, headers, balance="1000.00")
    account_b = await _create_account(client, headers, balance="500.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Groceries",
            "amount": "100.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_a,
        },
    )
    tx_id = resp.json()["id"]
    assert await _get_account_balance(client, headers, account_a) == Decimal("900.00")

    resp_patch = await client.patch(
        f"/api/v1/transactions/{tx_id}",
        headers=headers,
        json={"account_id": account_b},
    )
    assert resp_patch.status_code == 200

    assert await _get_account_balance(client, headers, account_a) == Decimal("1000.00")
    assert await _get_account_balance(client, headers, account_b) == Decimal("400.00")


@pytest.mark.asyncio
async def test_deleting_transaction_reverses_account_balance(client: AsyncClient):
    """Deleting a transaction should undo its balance effect."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="1000.00")

    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Groceries",
            "amount": "200.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_id,
        },
    )
    tx_id = resp.json()["id"]
    assert await _get_account_balance(client, headers, account_id) == Decimal("800.00")

    resp_del = await client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert resp_del.status_code == 204

    assert await _get_account_balance(client, headers, account_id) == Decimal("1000.00")


@pytest.mark.asyncio
async def test_mixed_sequence_of_movements_ends_at_correct_balance(client: AsyncClient):
    """A mixed sequence of create/update/delete transactions converges on the right balance."""
    headers = create_auth_headers()
    account_id = await _create_account(client, headers, balance="0.00")

    # +2000 income
    resp1 = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Salary",
            "amount": "2000.00",
            "transaction_type": TransactionType.INCOME,
            "account_id": account_id,
        },
    )
    tx1_id = resp1.json()["id"]

    # -300 expense
    await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Rent",
            "amount": "300.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_id,
        },
    )

    # -50 expense, later deleted
    resp3 = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Impulse buy",
            "amount": "50.00",
            "transaction_type": TransactionType.EXPENSE,
            "account_id": account_id,
        },
    )
    tx3_id = resp3.json()["id"]

    # Balance so far: 2000 - 300 - 50 = 1650
    assert await _get_account_balance(client, headers, account_id) == Decimal("1650.00")

    # Delete the impulse buy: back to 1700
    await client.delete(f"/api/v1/transactions/{tx3_id}", headers=headers)
    assert await _get_account_balance(client, headers, account_id) == Decimal("1700.00")

    # Bump the salary transaction up by 500 (now 2500 income)
    await client.patch(
        f"/api/v1/transactions/{tx1_id}",
        headers=headers,
        json={"amount": "2500.00"},
    )
    # 1700 + 500 = 2200
    assert await _get_account_balance(client, headers, account_id) == Decimal("2200.00")


@pytest.mark.asyncio
async def test_repeated_atomic_deltas_never_lose_an_update(db_session: AsyncSession):
    """The atomic `UPDATE ... SET balance = balance + :delta` path never loses an increment.

    The test suite runs against SQLite with a single shared connection per test (see
    tests/conftest.py), so it cannot exercise real multi-connection row locking against
    Postgres. This asserts the code path used under real concurrency -- an atomic in-database
    increment rather than a Python read-modify-write -- always accumulates correctly, which is
    exactly the property that prevents lost updates when writers overlap on Postgres.
    """
    household_id = uuid4()
    account = Account(
        household_id=household_id,
        name="Shared",
        account_type=AccountType.CHECKING,
        balance=Decimal("0.00"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    from src.features.transactions.balances import apply_balance_deltas

    for _ in range(20):
        await apply_balance_deltas(
            session=db_session,
            account_id=account.id,
            pot_id=None,
            account_delta=Decimal("10.00"),
            pot_delta=Decimal("0.00"),
        )
    await db_session.commit()

    result = await db_session.exec(select(Account).where(Account.id == account.id))
    refreshed = result.first()
    assert refreshed is not None
    assert refreshed.balance == Decimal("200.00")


@pytest.mark.asyncio
async def test_transaction_without_account_or_pot_does_not_error(client: AsyncClient):
    """A transaction with no linked account/pot should not raise and should leave nothing to update."""
    headers = create_auth_headers()
    resp = await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Cash purchase",
            "amount": "20.00",
            "transaction_type": TransactionType.EXPENSE,
        },
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_pot_created_with_default_overflow_target_still_tracks_balance(client: AsyncClient):
    """Sanity check that pot balance tracking is independent of overflow_target/cascade logic."""
    headers = create_auth_headers()
    resp_pot = await client.post(
        "/api/v1/pots/",
        headers=headers,
        json={"name": "Emergency", "priority": 2, "overflow_target": OverflowTarget.UNASSIGNED},
    )
    pot_id = resp_pot.json()["id"]

    await client.post(
        "/api/v1/transactions/",
        headers=headers,
        json={
            "description": "Add to emergency fund",
            "amount": "150.00",
            "transaction_type": TransactionType.INCOME,
            "pot_id": pot_id,
        },
    )

    amount = await _get_pot_amount(client, headers, pot_id)
    assert amount == Decimal("150.00")
