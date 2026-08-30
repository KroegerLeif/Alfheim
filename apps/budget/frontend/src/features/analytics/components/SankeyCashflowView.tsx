"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { GitMerge, ArrowRight, Wallet, PiggyBank, PieChart } from "lucide-react";

export interface SankeyCashflowViewProps {
  totalIncome?: number;
  totalAllocatedPlans?: number;
  totalPotsContribution?: number;
  unassignedSurplus?: number;
}

export function SankeyCashflowView({
  totalIncome = 4500,
  totalAllocatedPlans = 2800,
  totalPotsContribution = 1200,
  unassignedSurplus = 500,
}: SankeyCashflowViewProps) {
  return (
    <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[var(--primary-main)]" />
            <span>Sankey Cashflow Flow</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Visual breakdown of incoming revenues distributed into budget plans and virtual sinking funds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Step 1: Inflow */}
        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-2 text-center">
          <div className="flex justify-center text-emerald-500">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium">Monthly Household Inflow</p>
          <MoneyDisplay amount={totalIncome} size="lg" className="font-bold text-emerald-500" />
        </div>

        {/* Step 2: Distribution node */}
        <div className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)]">
          <ArrowRight className="w-6 h-6 hidden md:block text-[var(--primary-main)]" />
          <span className="text-[11px] font-mono font-bold">Priority Allocation</span>
        </div>

        {/* Step 3: Outflow Targets */}
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-[var(--text-main)]">Budget Plans</span>
            </div>
            <MoneyDisplay amount={totalAllocatedPlans} size="sm" className="font-bold" />
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-[var(--text-main)]">Virtual Pots</span>
            </div>
            <MoneyDisplay amount={totalPotsContribution} size="sm" className="font-bold" />
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-[var(--text-main)]">Unassigned Surplus</span>
            </div>
            <MoneyDisplay amount={unassignedSurplus} size="sm" className="font-bold text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
