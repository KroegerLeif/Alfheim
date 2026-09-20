"use client";

import React from "react";
import { MoneyDisplay, useTranslation } from "@alfheim/shared";
import { GitMerge, ArrowRight, Wallet, PiggyBank, PieChart, Info } from "lucide-react";

export interface SankeyCashflowViewProps {
  /** Whether the household's base data (accounts/plans/pots/transactions) has finished loading. */
  loading?: boolean;
  totalIncome: number;
  totalAllocatedPlans: number;
  totalPotsContribution: number;
  unassignedSurplus: number;
  /** True once at least one real data point (income, plan or pot) exists for this household. */
  hasData: boolean;
}

export function SankeyCashflowView({
  loading = false,
  totalIncome,
  totalAllocatedPlans,
  totalPotsContribution,
  unassignedSurplus,
  hasData,
}: SankeyCashflowViewProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
        <div className="h-6 w-48 rounded bg-[var(--surface-canvas)] animate-pulse" />
        <div className="h-32 rounded-xl bg-[var(--surface-canvas)] animate-pulse" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-center space-y-2 shadow-xs">
        <Info className="w-6 h-6 mx-auto text-[var(--text-muted)]" />
        <h3 className="text-base font-semibold text-[var(--text-main)]">{t("budget.analytics.sankeyEmptyTitle")}</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">{t("budget.analytics.sankeyEmptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[var(--primary-main)]" />
            <span>{t("budget.analytics.sankeyTitle")}</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("budget.analytics.sankeyDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Step 1: Inflow */}
        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-2 text-center">
          <div className="flex justify-center text-emerald-500">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium">{t("budget.analytics.monthlyInflow")}</p>
          <MoneyDisplay amount={totalIncome} size="lg" className="font-bold text-emerald-500" />
        </div>

        {/* Step 2: Distribution node */}
        <div className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)]">
          <ArrowRight className="w-6 h-6 hidden md:block text-[var(--primary-main)]" />
          <span className="text-[11px] font-mono font-bold">{t("budget.analytics.priorityAllocation")}</span>
        </div>

        {/* Step 3: Outflow Targets */}
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-[var(--text-main)]">{t("budget.analytics.budgetPlansLabel")}</span>
            </div>
            <MoneyDisplay amount={totalAllocatedPlans} size="sm" className="font-bold" />
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-[var(--text-main)]">{t("budget.analytics.virtualPotsLabel")}</span>
            </div>
            <MoneyDisplay amount={totalPotsContribution} size="sm" className="font-bold" />
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-[var(--text-main)]">{t("budget.analytics.unassignedSurplus")}</span>
            </div>
            <MoneyDisplay amount={unassignedSurplus} size="sm" className="font-bold text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
