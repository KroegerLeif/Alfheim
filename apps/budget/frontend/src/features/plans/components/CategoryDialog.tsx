"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, useTranslation } from "@alfheim/shared";
import { PlanCategoryCreate } from "@/features/budget/types";
import { FormError } from "@/components/shared/FormError";
import { useFormSubmit } from "@/components/shared/useFormSubmit";

export interface CategoryDialogProps {
  open: boolean;
  parentId?: string | null;
  onClose: () => void;
  onSubmit: (data: PlanCategoryCreate) => Promise<void>;
}

export function CategoryDialog({ open, parentId, onClose, onSubmit }: CategoryDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("0.00");
  const { submitting, error, run } = useFormSubmit(open);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await run(() =>
      onSubmit({
        name,
        parent_id: parentId || null,
        allocated_amount: parseFloat(allocatedAmount) || 0,
      })
    );
    if (!saved) return;
    setName("");
    setAllocatedAmount("0.00");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-lg font-bold text-[var(--text-main)]">
          {parentId ? t("budget.plans.addSubcategory") : t("budget.plans.addCategoryTitle")}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.plans.categoryName")}</label>
            <input
              id="category-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("budget.plans.categoryNamePlaceholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
            />
          </div>

          <div>
            <label htmlFor="category-amount" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.plans.allocatedAmount")}</label>
            <input
              id="category-amount"
              type="number"
              step="0.01"
              required
              value={allocatedAmount}
              onChange={(e) => setAllocatedAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)] font-mono"
            />
          </div>

          <FormError message={error} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-canvas)]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t("budget.plans.creating") : t("budget.plans.createCategory")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
