"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { Plan, PlanSummaryResponse } from "@/features/budget/types";
import { Plus, Trash2, Edit2 } from "lucide-react";

export interface PlanOverviewProps {
  plan: Plan | null;
  summary: PlanSummaryResponse | null;
  loading?: boolean;
  onAddPlan: () => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (id: string) => void;
  onAddCategory: () => void;
}

export function PlanOverview({
  plan,
  summary,
  loading,
  onAddPlan,
  onEditPlan,
  onDeletePlan,
  onAddCategory,
}: PlanOverviewProps) {
  if (loading) {
    return <div className="h-40 rounded-2xl bg-[var(--surface-card)] animate-pulse" />;
  }

  if (!plan) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
        <p className="text-sm text-[var(--text-muted)]">No active plan selected or found.</p>
        <button
          type="button"
          onClick={onAddPlan}
          className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Budget Plan</span>
        </button>
      </div>
    );
  }

  const allocated = summary?.total_allocated ?? 0;
  const total = plan.total_budget;
  const unallocated = summary?.unallocated_balance ?? total - allocated;

  return (
    <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[var(--text-main)]">{plan.name}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary-main)]/10 text-[var(--primary-main)] uppercase">
              {plan.plan_type}
            </span>
          </div>
          {plan.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{plan.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddCategory}
            className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
          <button
            type="button"
            onClick={() => onEditPlan(plan)}
            aria-label={`Edit ${plan.name}`}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDeletePlan(plan.id)}
            aria-label={`Delete ${plan.name}`}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-xl bg-[var(--surface-canvas)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Total Budget</p>
          <MoneyDisplay amount={total} size="lg" className="font-bold text-[var(--text-main)]" />
        </div>
        <div className="p-3 rounded-xl bg-[var(--surface-canvas)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Total Allocated</p>
          <MoneyDisplay amount={allocated} size="lg" className="font-bold text-indigo-500" />
        </div>
        <div className="p-3 rounded-xl bg-[var(--surface-canvas)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Unallocated</p>
          <MoneyDisplay amount={unallocated} size="lg" className="font-bold text-emerald-500" />
        </div>
      </div>
    </div>
  );
}
