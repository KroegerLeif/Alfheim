"use client";

import React, { useState } from "react";
import { PlanCategoryCreate } from "@/features/budget/types";
import { X } from "lucide-react";

export interface CategoryDialogProps {
  open: boolean;
  parentId?: string | null;
  onClose: () => void;
  onSubmit: (data: PlanCategoryCreate) => Promise<void>;
}

export function CategoryDialog({ open, parentId, onClose, onSubmit }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("0.00");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        parent_id: parentId || null,
        allocated_amount: parseFloat(allocatedAmount) || 0,
      });
      setName("");
      setAllocatedAmount("0.00");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-bold text-[var(--text-main)]">
            {parentId ? "Add Subcategory" : "Add Budget Category"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-canvas)]">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Category Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Allocated Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={allocatedAmount}
              onChange={(e) => setAllocatedAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-canvas)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
