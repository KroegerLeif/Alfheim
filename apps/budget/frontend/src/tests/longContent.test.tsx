import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AccountList } from "../features/accounts";
import { PotCard, PotsView } from "../features/pots";
import { PlanOverview, CategoryTree } from "../features/plans";
import { TransactionLedger } from "../features/transactions";
import { NetWorthAnalyticsView } from "../features/analytics";
import { ErrorBanner } from "../components/shared/ErrorBanner";
import { LONG_NAME, longAccount, longCategory, longPlan, longPot, longTransaction } from "./fixtures";

// Rows and cards must keep very long user content inside their box: the text node has to be
// truncated (or wrapped) and its flex parent has to be allowed to shrink (`min-w-0`), otherwise a
// single long name widens the whole page on a phone.

function expectTruncated(element: HTMLElement) {
  expect(element).toHaveClass("truncate");
  expect(element).toHaveAttribute("title", LONG_NAME);
}

describe("long user content stays inside its container", () => {
  it("truncates account names and keeps the actions visible", () => {
    render(
      <AccountList
        accounts={[longAccount]}
        onAddAccount={vi.fn()}
        onEditAccount={vi.fn()}
        onDeleteAccount={vi.fn()}
      />
    );
    const name = screen.getByText(LONG_NAME);
    expectTruncated(name);
    expect(name.parentElement).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: `${LONG_NAME} löschen` }).closest("div.shrink-0")).not.toBeNull();
  });

  it("truncates the pot name in the meter header and wraps the card on narrow screens", () => {
    const { container } = render(<PotCard pot={longPot} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(container.firstElementChild).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: `${LONG_NAME} bearbeiten` })).toBeInTheDocument();
    expect(screen.getByText("Investment-Pool")).toHaveClass("truncate");
  });

  it("renders the pots tab with a long pot name", () => {
    render(<PotsView pots={[longPot]} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: `${LONG_NAME} löschen` })).toBeInTheDocument();
  });

  it("truncates plan names and wraps long descriptions", () => {
    render(
      <PlanOverview
        plan={longPlan}
        summary={null}
        onAddPlan={vi.fn()}
        onEditPlan={vi.fn()}
        onDeletePlan={vi.fn()}
        onAddCategory={vi.fn()}
      />
    );
    expectTruncated(screen.getByRole("heading", { name: LONG_NAME }));
    const description = screen.getByText(LONG_NAME.repeat(3));
    expect(description).toHaveClass("break-words");
    expect(screen.getByText("Event-Budget")).toBeInTheDocument();
  });

  it("truncates category and subcategory names", () => {
    render(<CategoryTree categories={[longCategory]} onAddSubcategory={vi.fn()} onDeleteCategory={vi.fn()} />);
    const names = screen.getAllByText(LONG_NAME);
    expect(names).toHaveLength(2);
    names.forEach(expectTruncated);
  });

  it("tolerates a category without a subcategories array", () => {
    const { subcategories: _omitted, ...flat } = longCategory;
    render(<CategoryTree categories={[flat]} onAddSubcategory={vi.fn()} onDeleteCategory={vi.fn()} />);
    expect(screen.getAllByText(LONG_NAME)).toHaveLength(1);
  });

  it("truncates transaction descriptions in the ledger", () => {
    render(
      <TransactionLedger
        transactions={[longTransaction]}
        onNewTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );
    const description = screen.getByText(LONG_NAME);
    expectTruncated(description);
    expect(screen.getByText("Schnell")).toHaveClass("shrink-0");
  });

  it("truncates account names in the net-worth breakdown and localizes the account type", () => {
    render(<NetWorthAnalyticsView netWorth={null} accounts={[longAccount]} />);
    expectTruncated(screen.getByText(LONG_NAME));
    expect(screen.getByText("(Girokonto)")).toBeInTheDocument();
  });

  it("wraps long error messages in the banner", () => {
    render(<ErrorBanner message={LONG_NAME.repeat(4)} actionLabel="Dismiss" onAction={vi.fn()} />);
    expect(screen.getByText(LONG_NAME.repeat(4))).toHaveClass("break-words");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
