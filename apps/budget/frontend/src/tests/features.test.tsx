import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { NetWorthCard, AccountList } from "../features/accounts";
import { PotCard } from "../features/pots";
import { TransactionLedger, QuickAddModal } from "../features/transactions";
import { Account, Pot, Transaction } from "../features/budget/types";

describe("Accounts Feature Components", () => {
  it("renders NetWorthCard correctly", () => {
    const summary = {
      liquid_assets: 5000,
      investments: 15000,
      total_net_worth: 20000,
      accounts_count: 2,
    };
    render(<NetWorthCard summary={summary} />);

    expect(screen.getByText("Total Net-Worth")).toBeInTheDocument();
    expect(screen.getByText("Liquid Assets")).toBeInTheDocument();
    expect(screen.getByText("Investments")).toBeInTheDocument();
  });

  it("renders AccountList and triggers add account callback", () => {
    const mockAccounts: Account[] = [
      {
        id: "acc-1",
        household_id: "hh-1",
        name: "Main Checking",
        account_type: "CHECKING",
        balance: 2500,
        currency: "EUR",
        is_active: true,
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
    ];
    const handleAdd = vi.fn();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <AccountList
        accounts={mockAccounts}
        onAddAccount={handleAdd}
        onEditAccount={handleEdit}
        onDeleteAccount={handleDelete}
      />
    );

    expect(screen.getByText("Main Checking")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Account" }));
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });
});

describe("Virtual Pots & Transactions Components", () => {
  it("renders PotCard with priority and progress", () => {
    const mockPot: Pot = {
      id: "pot-1",
      household_id: "hh-1",
      name: "Emergency Pot",
      priority: 1,
      target_amount: 5000,
      current_amount: 2500,
      monthly_contribution: 500,
      overflow_target: "CASCADE",
      is_active: true,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(<PotCard pot={mockPot} onEdit={handleEdit} onDelete={handleDelete} />);

    expect(screen.getByText("Emergency Pot")).toBeInTheDocument();
    expect(screen.getByText("Priority 1")).toBeInTheDocument();
  });

  it("renders TransactionLedger and QuickAddModal", () => {
    const mockTxs: Transaction[] = [
      {
        id: "tx-1",
        household_id: "hh-1",
        description: "Supermarket Groceries",
        amount: 45.5,
        currency: "EUR",
        transaction_type: "EXPENSE",
        transaction_date: "2025-01-10",
        is_quick_add: true,
        created_at: "2025-01-10",
        updated_at: "2025-01-10",
      },
    ];
    const handleNewTx = vi.fn();
    const handleDeleteTx = vi.fn();

    render(
      <TransactionLedger
        transactions={mockTxs}
        onNewTransaction={handleNewTx}
        onDeleteTransaction={handleDeleteTx}
      />
    );

    expect(screen.getByText("Supermarket Groceries")).toBeInTheDocument();

    const handleClose = vi.fn();
    const handleSubmit = vi.fn();
    render(
      <QuickAddModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    expect(screen.getByText("Quick-Add Transaction")).toBeInTheDocument();
  });
});
