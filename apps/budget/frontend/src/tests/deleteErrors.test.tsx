import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import BudgetHomePage from "@/app/[locale]/page";
import { renderWithProviders } from "./utils";

// Regression tests for issue #544: a failed delete request (e.g. the backend's 409 "still
// referenced by transactions" conflict) must surface via the page's error banner instead of the
// button silently doing nothing.

vi.mock("@/features/dashboard/useBudgetData", () => ({
  budgetKeys: { all: ["budget"] },
  useBudgetData: () => ({
    accounts: [
      {
        id: "acc-1",
        household_id: "hh-1",
        name: "Referenced Checking",
        account_type: "CHECKING",
        balance: 100,
        currency: "EUR",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
    netWorth: null,
    pots: [],
    plans: [],
    activePlan: null,
    planSummary: null,
    transactions: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/features/accounts", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/features/accounts");
  return {
    ...actual,
    accountsApi: {
      ...(actual.accountsApi as Record<string, unknown>),
      deleteAccount: vi.fn().mockRejectedValue(
        new Error("Cannot delete account: 1 transaction(s) still reference it. Reassign or delete those transactions first.")
      ),
    },
  };
});

describe("BudgetHomePage delete error handling", () => {
  it("shows the server's error message in a banner when deleting a referenced account fails", async () => {
    renderWithProviders(<BudgetHomePage />);

    const deleteBtn = screen.getByRole("button", { name: /Delete Referenced Checking/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/still reference it/i)).toBeInTheDocument();
    });

    // The account must still be visible -- the delete did not silently succeed or vanish.
    expect(screen.getByText("Referenced Checking")).toBeInTheDocument();
  });
});
