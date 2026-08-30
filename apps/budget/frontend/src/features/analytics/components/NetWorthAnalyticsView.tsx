"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { NetWorthResponse, Account } from "@/features/budget/types";
import { TrendingUp, ShieldCheck, Landmark } from "lucide-react";

export interface NetWorthAnalyticsViewProps {
  netWorth?: NetWorthResponse | null;
  accounts?: Account[];
}

export function NetWorthAnalyticsView({
  netWorth,
  accounts = [],
}: NetWorthAnalyticsViewProps) {
  const liquid = netWorth?.liquid_assets ?? 0;
  const investments = netWorth?.investments ?? 0;
  const total = netWorth?.total_net_worth ?? 0;

  const liquidRatio = total > 0 ? ((liquid / total) * 100).toFixed(1) : "0";
  const investRatio = total > 0 ? ((investments / total) * 100).toFixed(1) : "0";

  return (
    <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--primary-main)]" />
            <span>Net-Worth Analytics & Asset Allocation</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Distribution across liquid capital and investment vehicles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-500" />
              <span>Liquid Assets</span>
            </span>
            <span className="text-xs font-mono font-bold text-emerald-500">{liquidRatio}%</span>
          </div>
          <MoneyDisplay amount={liquid} size="lg" className="font-bold text-[var(--text-main)]" />
          <p className="text-[11px] text-[var(--text-muted)]">
            Includes checking accounts, instant savings, and liquid emergency cash.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>Investment Portfolio</span>
            </span>
            <span className="text-xs font-mono font-bold text-indigo-500">{investRatio}%</span>
          </div>
          <MoneyDisplay amount={investments} size="lg" className="font-bold text-[var(--text-main)]" />
          <p className="text-[11px] text-[var(--text-muted)]">
            Securities, ETFs, and long-term building savings contracts.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Asset Breakdown</h4>
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-3 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-semibold text-[var(--text-main)]">{acc.name}</span>
                <span className="ml-2 text-[10px] uppercase text-[var(--text-muted)]">({acc.account_type})</span>
              </div>
              <MoneyDisplay amount={acc.balance} currency={acc.currency} size="sm" className="font-bold" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
