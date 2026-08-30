"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { PlanCategory } from "@/features/budget/types";
import { Folder, CornerDownRight, Plus, Trash2 } from "lucide-react";

export interface CategoryTreeProps {
  categories: PlanCategory[];
  onAddSubcategory?: (parentId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
}

export function CategoryTree({
  categories,
  onAddSubcategory,
  onDeleteCategory,
}: CategoryTreeProps) {
  if (categories.length === 0) {
    return (
      <div className="p-6 text-center rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
        No budget categories added yet. Click &quot;Add Category&quot; above to allocate your budget.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) => (
        <div key={cat.id} className="space-y-1">
          <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-[var(--primary-main)]" />
              <span className="font-semibold text-sm text-[var(--text-main)]">{cat.name}</span>
            </div>

            <div className="flex items-center gap-3">
              <MoneyDisplay amount={cat.allocated_amount} size="md" className="font-bold" />
              <div className="flex items-center gap-1">
                {onAddSubcategory && (
                  <button
                    type="button"
                    onClick={() => onAddSubcategory(cat.id)}
                    title="Add Subcategory"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteCategory && (
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(cat.id)}
                    aria-label={`Delete category ${cat.name}`}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {cat.subcategories && cat.subcategories.length > 0 && (
            <div className="pl-6 space-y-1">
              {cat.subcategories.map((sub) => (
                <div
                  key={sub.id}
                  className="p-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CornerDownRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="font-medium text-[var(--text-main)]">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyDisplay amount={sub.allocated_amount} size="sm" className="font-semibold" />
                    {onDeleteCategory && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(sub.id)}
                        aria-label={`Delete subcategory ${sub.name}`}
                        className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
