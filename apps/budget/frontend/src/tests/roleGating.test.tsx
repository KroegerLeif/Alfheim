import React from "react";
import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { AccountList } from "../features/accounts";
import { PotCard } from "../features/pots";
import { PlanOverview } from "../features/plans";
import { TransactionLedger } from "../features/transactions";
import { Account, Plan, Pot, Transaction } from "../features/budget/types";
import { renderWithProviders } from "./utils";

const account: Account = {
  id: "acc-1",
  household_id: "hh-1",
  name: "Main Checking",
  account_type: "CHECKING",
  balance: 2500,
  currency: "EUR",
  is_active: true,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};

const pot: Pot = {
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

const plan: Plan = {
  id: "plan-1",
  household_id: "hh-1",
  name: "October",
  plan_type: "MONTHLY",
  total_budget: 1000,
  is_active: true,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};

const tx: Transaction = {
  id: "tx-1",
  household_id: "hh-1",
  description: "Groceries",
  amount: 45.5,
  currency: "EUR",
  transaction_type: "EXPENSE",
  transaction_date: "2025-01-10",
  is_quick_add: true,
  created_at: "2025-01-10",
  updated_at: "2025-01-10",
};

function renderAll(role: string) {
  const noop = vi.fn();
  return renderWithProviders(
    <>
      <AccountList accounts={[account]} onAddAccount={noop} onEditAccount={noop} onDeleteAccount={noop} />
      <PotCard pot={pot} onEdit={noop} onDelete={noop} />
      <PlanOverview
        plan={plan}
        summary={null}
        onAddPlan={noop}
        onEditPlan={noop}
        onDeletePlan={noop}
        onAddCategory={noop}
      />
      <TransactionLedger transactions={[tx]} onNewTransaction={noop} onDeleteTransaction={noop} />
    </>,
    { role }
  );
}

const ADMIN_DELETES = ["Delete Main Checking", "Delete Emergency Pot", "Delete October"];

describe("household role gating", () => {
  it("GUEST sees no create, edit or delete controls", () => {
    renderAll("GUEST");
    expect(screen.queryByRole("button", { name: /new account/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add category/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /quick-add/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^edit /i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^delete /i })).toBeNull();
  });

  it("MEMBER can write but the shared-structure deletes are disabled with a hint", () => {
    renderAll("MEMBER");
    expect(screen.getByRole("button", { name: "Edit Main Checking" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /add category/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete transaction Groceries" })).toBeEnabled();
    for (const name of ADMIN_DELETES) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button.closest("[title]")).toHaveAttribute("title", expect.stringMatching(/admins and owners/));
    }
  });

  it("ADMIN gets every control enabled", () => {
    renderAll("ADMIN");
    for (const name of ADMIN_DELETES) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    expect(screen.queryByTestId("permission-hint")).toBeNull();
  });
});
