"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { NetWorthResponse } from "@/features/budget/types";
import { Wallet, TrendingUp, PiggyBank } from "lucide-react";

export interface NetWorthCardProps {
  summary: NetWorthResponse | null;
  loading?: boolean;
}

export function NetWorthCard({ summary, loading }: NetWorthCardProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-4 bg-[var(--surface-canvas)] rounded w-1/3" />
        <div className="h-8 bg-[var(--surface-canvas)] rounded w-1/2" />
      </div>
    );
  }

  const liquid = summary?.liquid_assets ?? 0;
  const investments = summary?.investments ?? 0;
  const total = summary?.total_net_worth ?? 0;

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-canvas)] border border-[var(--border-subtle)] shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text-muted)]">Total Net-Worth</span>
        <div className="p-2 rounded-xl bg-[var(--primary-main)]/10 text-[var(--primary-main)]">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>
      <div className="mb-6">
        <MoneyDisplay amount={total} size="xl" className="text-3xl font-extrabold text-[var(--text-main)]" />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-subtle)] text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Liquid Assets</p>
            <MoneyDisplay amount={liquid} size="sm" className="font-bold text-[var(--text-main)]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[var(--text-muted)]">Investments</p>
            <MoneyDisplay amount={investments} size="sm" className="font-bold text-[var(--text-main)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
