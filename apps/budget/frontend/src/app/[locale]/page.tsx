"use client";

import React, { useState } from "react";
import { DesktopSidebar, MobileTabBar } from "@/features/navigation";
import { useBudgetData } from "@/features/dashboard/useBudgetData";
import { DashboardOverview } from "@/features/dashboard/DashboardOverview";
import { BudgetDialogContainer } from "@/features/dashboard/BudgetDialogContainer";
import { AccountList, accountsApi } from "@/features/accounts";
import { PotCard, potsApi } from "@/features/pots";
import { PlanOverview, CategoryTree, plansApi } from "@/features/plans";
import { TransactionLedger, transactionsApi } from "@/features/transactions";
import { SankeyCashflowView, NetWorthAnalyticsView } from "@/features/analytics";
import { Account, Pot, Plan } from "@/features/budget/types";
import { Plus, RefreshCw, AlertCircle } from "lucide-react";

export default function BudgetHomePage() {
  const [activeTab, setActiveTab] = useState<string>("/");
  const [planningMode, setPlanningMode] = useState<"monthly" | "event">("monthly");

  const { accounts, netWorth, pots, plans, activePlan, planSummary, transactions, loading, error, reload } =
    useBudgetData(planningMode);

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

      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)]">Budget & Treasury</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Financial overview, virtual pots, recurring plans, and cashflow tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh Budget Data"
            className="p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{error}</span></span>
            <button type="button" onClick={reload} className="font-bold underline">Retry</button>
          </div>
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
            onDeleteAccount={async (id) => { await accountsApi.deleteAccount(id); reload(); }}
            onEditPot={(p) => { setEditPot(p); setPotOpen(true); }}
            onDeletePot={async (id) => { await potsApi.deletePot(id); reload(); }}
            onOpenCascadeModal={() => setCascadeOpen(true)}
            onQuickAdd={() => setQuickAddOpen(true)}
            onDeleteTransaction={async (id) => { await transactionsApi.deleteTransaction(id); reload(); }}
          />
        )}

        {activeTab === "/accounts" && (
          <AccountList
            accounts={accounts}
            loading={loading}
            onAddAccount={() => { setEditAcc(null); setAccOpen(true); }}
            onEditAccount={(acc) => { setEditAcc(acc); setAccOpen(true); }}
            onDeleteAccount={async (id) => { await accountsApi.deleteAccount(id); reload(); }}
          />
        )}

        {activeTab === "/planning" && (
          <div className="space-y-6">
            <PlanOverview
              plan={activePlan}
              summary={planSummary}
              loading={loading}
              onAddPlan={() => { setEditPlan(null); setPlanOpen(true); }}
              onEditPlan={(pl) => { setEditPlan(pl); setPlanOpen(true); }}
              onDeletePlan={async (id) => { await plansApi.deletePlan(id); reload(); }}
              onAddCategory={() => { setCatParentId(null); setCatOpen(true); }}
            />
            <CategoryTree
              categories={planSummary?.categories || []}
              onAddSubcategory={(pId) => { setCatParentId(pId); setCatOpen(true); }}
              onDeleteCategory={async (cId) => { await plansApi.deleteCategory(cId); reload(); }}
            />
          </div>
        )}

        {activeTab === "/pots" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-main)]">Virtual Pots</h3>
              <button
                type="button"
                onClick={() => { setEditPot(null); setPotOpen(true); }}
                className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /><span>New Pot</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pots.map((pot) => (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  onEdit={(p) => { setEditPot(p); setPotOpen(true); }}
                  onDelete={async (id) => { await potsApi.deletePot(id); reload(); }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "/transactions" && (
          <TransactionLedger
            transactions={transactions}
            loading={loading}
            onNewTransaction={() => setQuickAddOpen(true)}
            onDeleteTransaction={async (id) => { await transactionsApi.deleteTransaction(id); reload(); }}
          />
        )}

        {activeTab === "/sankey" && <SankeyCashflowView />}
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
