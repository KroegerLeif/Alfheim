import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LanguageProvider } from "@alfheim/shared";
import { DashboardOverview } from "../features/dashboard/DashboardOverview";
import { BudgetPageHeader } from "../features/dashboard/BudgetPageHeader";
import { PotCard, PotDialog, potsApi } from "../features/pots";
import { PlanDialog, PlanOverview, CategoryDialog } from "../features/plans";
import { QuickAddModal } from "../features/transactions";
import { ACCOUNT_TYPE_KEYS, accountTypeLabel } from "../features/accounts/accountTypes";
import { computeCashflow } from "../features/analytics";
import { longAccount, longPlan, longPot, longTransaction } from "./fixtures";

// Every label of the formerly hardcoded views must come from the dictionary in all three
// languages. The test setup throws on unresolved keys, and these checks pin the real wording.

type Lang = "en" | "de" | "pl";

function inLanguage(ui: React.ReactElement, language: Lang) {
  return render(<LanguageProvider defaultLanguage={language}>{ui}</LanguageProvider>);
}

const noop = () => undefined;

describe("dashboard overview", () => {
  const overview = (
    <DashboardOverview
      netWorth={null}
      accounts={[longAccount]}
      pots={[]}
      transactions={[longTransaction]}
      loading={false}
      onAddAccount={noop}
      onEditAccount={noop}
      onDeleteAccount={noop}
      onEditPot={noop}
      onDeletePot={noop}
      onOpenCascadeModal={noop}
      onQuickAdd={noop}
      onDeleteTransaction={noop}
    />
  );

  it.each<[Lang, string[]]>([
    ["en", ["Virtual Pots", "Cascade Surplus", "No virtual pots configured.", "Total Net Worth"]],
    ["de", ["Virtuelle Töpfe", "Überschuss verteilen", "Keine virtuellen Töpfe angelegt.", "Gesamtvermögen"]],
    ["pl", ["Wirtualne Skarpety", "Rozdziel nadwyżkę", "Nie skonfigurowano wirtualnych skarpet.", "Majątek Netto Ogółem"]],
  ])("renders the %s labels", (language, labels) => {
    inLanguage(overview, language);
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });
});

describe("page header", () => {
  it("renders the polish title and subtitle", () => {
    inLanguage(<BudgetPageHeader loading={false} onReload={noop} />, "pl");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budżet i Skarbiec");
    expect(screen.getByText(/Przegląd finansów/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Odśwież dane budżetu" })).toBeInTheDocument();
  });
});

describe("pot card", () => {
  it("localizes badges, actions and the sinking-fund result", async () => {
    const spy = vi.spyOn(potsApi, "calculateSinkingFundGap").mockResolvedValue({
      pot_id: longPot.id,
      pot_name: longPot.name,
      current_amount: 2500,
      shortfall: 2500,
      remaining_months: 5,
      target_monthly_rate: 500,
      actual_monthly_rate: 100,
      gap: 400,
      has_gap: true,
      status: "WARNING",
    });
    inLanguage(<PotCard pot={{ ...longPot, name: "Reserve" }} onEdit={noop} onDelete={noop} />, "pl");

    expect(screen.getByText("Priorytet 3")).toBeInTheDocument();
    expect(screen.getByText("Pula inwestycyjna")).toBeInTheDocument();
    expect(screen.getByText("Brak daty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Oblicz lukę dla Reserve" }));

    expect(await screen.findByText("Status: Luka w oszczędnościach")).toBeInTheDocument();
    expect(screen.getByText(/Niedobór/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows the failure of the gap calculation instead of only logging it", async () => {
    const spy = vi.spyOn(potsApi, "calculateSinkingFundGap").mockRejectedValue(new Error("Pot not found"));
    inLanguage(<PotCard pot={{ ...longPot, name: "Reserve" }} onEdit={noop} onDelete={noop} />, "en");

    fireEvent.click(screen.getByRole("button", { name: "Calculate gap for Reserve" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Pot not found"));
    spy.mockRestore();
  });
});

describe("dialogs", () => {
  it("renders the pot dialog in polish", () => {
    inLanguage(<PotDialog open pot={null} onClose={noop} onSubmit={vi.fn()} />, "pl");
    expect(screen.getByRole("heading", { name: "Utwórz wirtualną skarpetę" })).toBeInTheDocument();
    expect(screen.getByLabelText("Strategia przelewania")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("np. Fundusz awaryjny")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utwórz" })).toBeInTheDocument();
  });

  it("renders the plan dialog in english", () => {
    inLanguage(<PlanDialog open plan={null} onClose={noop} onSubmit={vi.fn()} />, "en");
    expect(screen.getByRole("heading", { name: "Create Budget Plan" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Monthly Recurring" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Optional notes or details")).toBeInTheDocument();
  });

  it("renders the category dialog for a subcategory in german", () => {
    inLanguage(<CategoryDialog open parentId="cat-1" onClose={noop} onSubmit={vi.fn()} />, "de");
    expect(screen.getByRole("heading", { name: "Unterkategorie hinzufügen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kategorie erstellen" })).toBeInTheDocument();
  });

  it("localizes the account types in the quick-add account list", () => {
    inLanguage(<QuickAddModal open accounts={[{ ...longAccount, name: "Main" }]} onClose={noop} onSubmit={vi.fn()} />, "pl");
    expect(screen.getByRole("option", { name: "Main (Konto Osobiste)" })).toBeInTheDocument();
    expect(screen.getByText("Kwota (EUR)")).toBeInTheDocument();
  });
});

describe("plan overview", () => {
  it("localizes the plan type badge and totals", () => {
    inLanguage(
      <PlanOverview plan={{ ...longPlan, name: "Trip", plan_type: "MONTHLY" }} summary={null} onAddPlan={noop} onEditPlan={noop} onDeletePlan={noop} onAddCategory={noop} />,
      "pl"
    );
    expect(screen.getByText("Budżet Miesięczny")).toBeInTheDocument();
    expect(screen.getByText("Budżet całkowity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edytuj Trip" })).toBeInTheDocument();
  });

  it("offers to create a plan when none is active", () => {
    inLanguage(<PlanOverview plan={null} summary={null} onAddPlan={noop} onEditPlan={noop} onDeletePlan={noop} onAddCategory={noop} />, "en");
    expect(screen.getByText("No active plan selected or found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Budget Plan" })).toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("resolves every backend account type to a dictionary key", () => {
    const t = (key: string) => `t:${key}`;
    Object.entries(ACCOUNT_TYPE_KEYS).forEach(([type, key]) => expect(accountTypeLabel(type, t)).toBe(`t:${key}`));
  });

  it("falls back to a readable label for an unknown account type", () => {
    expect(accountTypeLabel("CRYPTO_WALLET", (key) => key)).toBe("crypto wallet");
  });

  it("computes cashflow aggregates from real data only", () => {
    const empty = computeCashflow([], [], []);
    expect(empty).toEqual({ totalIncome: 0, totalAllocatedPlans: 0, totalPotsContribution: 0, unassignedSurplus: 0, hasData: false });

    const flow = computeCashflow(
      [
        { ...longTransaction, transaction_type: "INCOME", amount: 3000 },
        { ...longTransaction, id: "tx-2", transaction_type: "EXPENSE", amount: 50 },
      ],
      [longPlan, { ...longPlan, id: "plan-2", total_budget: 5000, is_active: false }],
      [longPot]
    );
    expect(flow.totalIncome).toBe(3000);
    expect(flow.totalAllocatedPlans).toBe(9999);
    expect(flow.totalPotsContribution).toBe(500);
    expect(flow.unassignedSurplus).toBe(0);
    expect(flow.hasData).toBe(true);
  });
});
