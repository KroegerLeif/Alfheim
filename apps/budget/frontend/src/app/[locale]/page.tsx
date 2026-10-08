"use client";

import React, { useMemo, useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { DesktopSidebar, MobileTabBar } from "@/features/navigation";
import { useBudgetData } from "@/features/dashboard/useBudgetData";
import { DashboardOverview } from "@/features/dashboard/DashboardOverview";
import { BudgetDialogContainer } from "@/features/dashboard/BudgetDialogContainer";
import { BudgetPageHeader } from "@/features/dashboard/BudgetPageHeader";
import { AccountList, accountsApi } from "@/features/accounts";
import { PotsView, potsApi } from "@/features/pots";
import { PlanningView, plansApi } from "@/features/plans";
import { TransactionLedger, transactionsApi } from "@/features/transactions";
import { SankeyCashflowView, NetWorthAnalyticsView, computeCashflow } from "@/features/analytics";
import { Account, Pot, Plan } from "@/features/budget/types";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

export default function BudgetHomePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("/");
  const [planningMode, setPlanningMode] = useState<"monthly" | "event">("monthly");
  const [actionError, setActionError] = useState<string | null>(null);

  const { accounts, netWorth, pots, plans, activePlan, planSummary, transactions, loading, error, reload } =
    useBudgetData(planningMode);

  // Every destructive action (delete) is wrapped through this so a failed request (e.g. a 409
  // "still referenced by transactions" conflict) surfaces via the error banner instead of the
  // button silently doing nothing. See issue #544.
  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message || t("budget.errors.requestFailed"));
    }
  };

  // Dialog State
  const [accOpen, setAccOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [potOpen, setPotOpen] = useState(false);
  const [editPot, setEditPot] = useState<Pot | null>(null);
  const [cascadeOpen, setCascadeOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catParentId, setCatParentId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const cashflow = useMemo(() => computeCashflow(transactions, plans, pots), [transactions, plans, pots]);

  const getMobileActiveTab = () => {
    if (activeTab === "/planning") return "planning";
    if (activeTab === "/pots") return "pots";
    return "dashboard";
  };

  return (
    <div className="flex min-h-screen bg-[var(--surface-canvas)]">
      <DesktopSidebar
        currentPath={activeTab}
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        onQuickAdd={() => setQuickAddOpen(true)}
        onTabChange={(path) => setActiveTab(path)}
      />

      <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto space-y-6">
        <BudgetPageHeader loading={loading} onReload={reload} />

        {error && <ErrorBanner message={error} actionLabel={t("budget.actions.retry")} onAction={reload} />}

        {actionError && (
          <ErrorBanner
            message={actionError}
            actionLabel={t("budget.actions.dismiss")}
            onAction={() => setActionError(null)}
          />
        )}

        {activeTab === "/" && (
          <DashboardOverview
            netWorth={netWorth}
            accounts={accounts}
            pots={pots}
            transactions={transactions}
            loading={loading}
            onAddAccount={() => { setEditAcc(null); setAccOpen(true); }}
            onEditAccount={(acc) => { setEditAcc(acc); setAccOpen(true); }}
            onDeleteAccount={(id) => runAction(() => accountsApi.deleteAccount(id))}
            onEditPot={(p) => { setEditPot(p); setPotOpen(true); }}
            onDeletePot={(id) => runAction(() => potsApi.deletePot(id))}
            onOpenCascadeModal={() => setCascadeOpen(true)}
            onQuickAdd={() => setQuickAddOpen(true)}
            onDeleteTransaction={(id) => runAction(() => transactionsApi.deleteTransaction(id))}
          />
        )}

        {activeTab === "/accounts" && (
          <AccountList
            accounts={accounts}
            loading={loading}
            onAddAccount={() => { setEditAcc(null); setAccOpen(true); }}
            onEditAccount={(acc) => { setEditAcc(acc); setAccOpen(true); }}
            onDeleteAccount={(id) => runAction(() => accountsApi.deleteAccount(id))}
          />
        )}

        {activeTab === "/planning" && (
          <PlanningView
            plan={activePlan}
            summary={planSummary}
            loading={loading}
            onAddPlan={() => { setEditPlan(null); setPlanOpen(true); }}
            onEditPlan={(pl) => { setEditPlan(pl); setPlanOpen(true); }}
            onDeletePlan={(id) => runAction(() => plansApi.deletePlan(id))}
            onAddCategory={() => { setCatParentId(null); setCatOpen(true); }}
            onAddSubcategory={(pId) => { setCatParentId(pId); setCatOpen(true); }}
            onDeleteCategory={(cId) => runAction(() => plansApi.deleteCategory(cId))}
          />
        )}

        {activeTab === "/pots" && (
          <PotsView
            pots={pots}
            onCreate={() => { setEditPot(null); setPotOpen(true); }}
            onEdit={(p) => { setEditPot(p); setPotOpen(true); }}
            onDelete={(id) => runAction(() => potsApi.deletePot(id))}
          />
        )}

        {activeTab === "/transactions" && (
          <TransactionLedger
            transactions={transactions}
            loading={loading}
            onNewTransaction={() => setQuickAddOpen(true)}
            onDeleteTransaction={(id) => runAction(() => transactionsApi.deleteTransaction(id))}
          />
        )}

        {activeTab === "/sankey" && (
          <SankeyCashflowView
            loading={loading}
            totalIncome={cashflow.totalIncome}
            totalAllocatedPlans={cashflow.totalAllocatedPlans}
            totalPotsContribution={cashflow.totalPotsContribution}
            unassignedSurplus={cashflow.unassignedSurplus}
            hasData={cashflow.hasData}
          />
        )}
        {activeTab === "/analytics" && <NetWorthAnalyticsView netWorth={netWorth} accounts={accounts} />}
      </main>

      <BudgetDialogContainer
        accountDialogOpen={accOpen}
        editingAccount={editAcc}
        onCloseAccountDialog={() => setAccOpen(false)}
        potDialogOpen={potOpen}
        editingPot={editPot}
        onClosePotDialog={() => setPotOpen(false)}
        cascadeModalOpen={cascadeOpen}
        onCloseCascadeModal={() => setCascadeOpen(false)}
        planDialogOpen={planOpen}
        editingPlan={editPlan}
        planningMode={planningMode}
        onClosePlanDialog={() => setPlanOpen(false)}
        categoryDialogOpen={catOpen}
        categoryParentId={catParentId}
        activePlan={activePlan}
        onCloseCategoryDialog={() => setCatOpen(false)}
        quickAddOpen={quickAddOpen}
        accounts={accounts}
        pots={pots}
        plans={plans}
        onCloseQuickAdd={() => setQuickAddOpen(false)}
        onReload={reload}
      />

      <MobileTabBar
        activeTab={getMobileActiveTab()}
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        onTabChange={(tab) => setActiveTab(tab === "planning" ? "/planning" : tab === "pots" ? "/pots" : "/")}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
    </div>
  );
}
