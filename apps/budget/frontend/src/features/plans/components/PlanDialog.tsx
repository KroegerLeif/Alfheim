"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@alfheim/shared";
import { Plan, PlanCreate, PlanType } from "@/features/budget/types";

export interface PlanDialogProps {
  open: boolean;
  plan?: Plan | null;
  defaultType?: PlanType;
  onClose: () => void;
  onSubmit: (data: PlanCreate) => Promise<void>;
}

export function PlanDialog({
  open,
  plan,
  defaultType = "MONTHLY",
  onClose,
  onSubmit,
}: PlanDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [planType, setPlanType] = useState<PlanType>(defaultType);
  const [totalBudget, setTotalBudget] = useState("0.00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || "");
      setPlanType(plan.plan_type);
      setTotalBudget(plan.total_budget.toString());
      setStartDate(plan.start_date || "");
      setEndDate(plan.end_date || "");
    } else {
      setName("");
      setDescription("");
      setPlanType(defaultType);
      setTotalBudget("0.00");
      setStartDate("");
      setEndDate("");
    }
  }, [plan, defaultType, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        description: description || null,
        plan_type: planType,
        total_budget: parseFloat(totalBudget) || 0,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-lg font-bold text-[var(--text-main)]">
          {plan ? "Edit Plan" : "Create Budget Plan"}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="plan-name" className="block text-xs font-medium text-[var(--text-muted)] mb-1">Plan Name</label>
            <input
              id="plan-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. November 2025 Household"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
            />
          </div>

          <div>
            <label htmlFor="plan-type" className="block text-xs font-medium text-[var(--text-muted)] mb-1">Plan Type</label>
            <select
              id="plan-type"
              value={planType}
              onChange={(e) => setPlanType(e.target.value as PlanType)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
            >
              <option value="MONTHLY">Monthly Recurring</option>
              <option value="EVENT">Event / Project</option>
            </select>
          </div>

          <div>
            <label htmlFor="plan-budget" className="block text-xs font-medium text-[var(--text-muted)] mb-1">Total Target Budget</label>
            <input
              id="plan-budget"
              type="number"
              step="0.01"
              required
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)] font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-start-date" className="block text-xs font-medium text-[var(--text-muted)] mb-1">Start Date</label>
              <input
                id="plan-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              />
            </div>
            <div>
              <label htmlFor="plan-end-date" className="block text-xs font-medium text-[var(--text-muted)] mb-1">End Date</label>
              <input
                id="plan-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="plan-description" className="block text-xs font-medium text-[var(--text-muted)] mb-1">Description</label>
            <textarea
              id="plan-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or details"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
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
              {submitting ? "Saving..." : plan ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
