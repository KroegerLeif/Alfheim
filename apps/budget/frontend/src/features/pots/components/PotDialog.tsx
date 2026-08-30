"use client";

import React, { useState, useEffect } from "react";
import { OverflowTarget, Pot, PotCreate } from "@/features/budget/types";
import { X } from "lucide-react";

export interface PotDialogProps {
  open: boolean;
  pot?: Pot | null;
  onClose: () => void;
  onSubmit: (data: PotCreate) => Promise<void>;
}

export function PotDialog({ open, pot, onClose, onSubmit }: PotDialogProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(1);
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0.00");
  const [monthlyContribution, setMonthlyContribution] = useState("0.00");
  const [targetDate, setTargetDate] = useState("");
  const [overflowTarget, setOverflowTarget] = useState<OverflowTarget>("CASCADE");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pot) {
      setName(pot.name);
      setPriority(pot.priority);
      setTargetAmount(pot.target_amount ? pot.target_amount.toString() : "");
      setCurrentAmount(pot.current_amount.toString());
      setMonthlyContribution(pot.monthly_contribution.toString());
      setTargetDate(pot.target_date || "");
      setOverflowTarget(pot.overflow_target);
    } else {
      setName("");
      setPriority(1);
      setTargetAmount("");
      setCurrentAmount("0.00");
      setMonthlyContribution("0.00");
      setTargetDate("");
      setOverflowTarget("CASCADE");
    }
  }, [pot, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        priority,
        target_amount: targetAmount ? parseFloat(targetAmount) : null,
        current_amount: parseFloat(currentAmount) || 0,
        monthly_contribution: parseFloat(monthlyContribution) || 0,
        target_date: targetDate || null,
        overflow_target: overflowTarget,
      });
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
            {pot ? "Edit Virtual Pot" : "Create Virtual Pot"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-canvas)]">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Pot Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Priority (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Overflow Strategy</label>
              <select
                value={overflowTarget}
                onChange={(e) => setOverflowTarget(e.target.value as OverflowTarget)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="CASCADE">Cascade to Next Pot</option>
                <option value="UNASSIGNED">Unassigned Buffer</option>
                <option value="INVESTMENT">Investment Pool</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Current Amount</label>
              <input
                type="number"
                step="0.01"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Target Amount</label>
              <input
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Monthly Contribution</label>
              <input
                type="number"
                step="0.01"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
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
              {submitting ? "Saving..." : pot ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
