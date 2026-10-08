"use client";

import React from "react";
import { Plan, PlanSummaryResponse } from "@/features/budget/types";
import { PlanOverview } from "./PlanOverview";
import { CategoryTree } from "./CategoryTree";

export interface PlanningViewProps {
  plan: Plan | null;
  summary: PlanSummaryResponse | null;
  loading: boolean;
  onAddPlan: () => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (id: string) => void;
  onAddCategory: () => void;
  onAddSubcategory: (parentId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
}

/** The "Planning" tab: the active plan with its category tree. */
export function PlanningView({
  plan,
  summary,
  loading,
  onAddPlan,
  onEditPlan,
  onDeletePlan,
  onAddCategory,
  onAddSubcategory,
  onDeleteCategory,
}: PlanningViewProps) {
  return (
    <div className="space-y-6">
      <PlanOverview
        plan={plan}
        summary={summary}
        loading={loading}
        onAddPlan={onAddPlan}
        onEditPlan={onEditPlan}
        onDeletePlan={onDeletePlan}
        onAddCategory={onAddCategory}
      />
      <CategoryTree
        categories={summary?.categories ?? []}
        onAddSubcategory={onAddSubcategory}
        onDeleteCategory={onDeleteCategory}
      />
    </div>
  );
}
