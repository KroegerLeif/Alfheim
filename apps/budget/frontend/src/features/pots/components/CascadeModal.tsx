"use client";

import React, { useState } from "react";
import { MoneyDisplay, Dialog, DialogContent, DialogTitle } from "@alfheim/shared";
import { CascadeAllocationResponse } from "@/features/budget/types";
import { potsApi } from "../api/potsApi";
import { GitMerge } from "lucide-react";

export interface CascadeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CascadeModal({ open, onClose, onSuccess }: CascadeModalProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CascadeAllocationResponse | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return;

    setSubmitting(true);
    try {
      const res = await potsApi.allocateCascade({ amount: val });
      setResult(res);
      onSuccess();
    } catch (err) {
      console.error("Cascade allocation failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-lg">
        <DialogTitle className="flex items-center gap-2 font-bold text-lg text-[var(--text-main)]">
          <GitMerge className="w-5 h-5 text-[var(--primary-main)]" />
          <span>Priority Cascade Allocation</span>
        </DialogTitle>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-[var(--text-muted)]">
              Distribute surplus funds down virtual pots ranked by priority (P1 through P10). Excess overflows into investment or unassigned buffers based on target rules.
            </p>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Total Surplus Amount</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500.00"
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
                {submitting ? "Processing..." : "Execute Cascade"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-[var(--text-main)]">Cascade Completed</p>
                <p className="text-[var(--text-muted)]">
                  Allocated <MoneyDisplay amount={result.total_allocated} size="sm" /> across pots.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {result.allocations.map((alloc) => (
                <div
                  key={alloc.pot_id}
                  className="p-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-[var(--text-main)]">{alloc.pot_name}</span>
                    <span className="ml-2 text-[10px] text-[var(--text-muted)]">P{alloc.priority}</span>
                  </div>
                  <MoneyDisplay amount={alloc.allocated_amount} size="sm" className="font-bold text-emerald-500" />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
