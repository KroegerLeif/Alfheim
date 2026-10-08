"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, useTranslation } from "@alfheim/shared";
import { OverflowTarget, Pot, PotCreate } from "@/features/budget/types";
import { FormError } from "@/components/shared/FormError";
import { useFormSubmit } from "@/components/shared/useFormSubmit";

export interface PotDialogProps {
  open: boolean;
  pot?: Pot | null;
  onClose: () => void;
  onSubmit: (data: PotCreate) => Promise<void>;
}

export function PotDialog({ open, pot, onClose, onSubmit }: PotDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(1);
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0.00");
  const [monthlyContribution, setMonthlyContribution] = useState("0.00");
  const [targetDate, setTargetDate] = useState("");
  const [overflowTarget, setOverflowTarget] = useState<OverflowTarget>("CASCADE");
  const { submitting, error, run } = useFormSubmit(open);

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
    const saved = await run(() =>
      onSubmit({
        name,
        priority,
        target_amount: targetAmount ? parseFloat(targetAmount) : null,
        current_amount: parseFloat(currentAmount) || 0,
        monthly_contribution: parseFloat(monthlyContribution) || 0,
        target_date: targetDate || null,
        overflow_target: overflowTarget,
      })
    );
    if (saved) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-lg font-bold text-[var(--text-main)]">
          {pot ? t("budget.pots.editPot") : t("budget.pots.createPotTitle")}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="pot-name" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.potName")}</label>
            <input
              id="pot-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("budget.pots.potNamePlaceholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pot-priority" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.priorityRange")}</label>
              <input
                id="pot-priority"
                type="number"
                min={1}
                max={10}
                required
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              />
            </div>
            <div>
              <label htmlFor="pot-overflow" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.overflowStrategy")}</label>
              <select
                id="pot-overflow"
                value={overflowTarget}
                onChange={(e) => setOverflowTarget(e.target.value as OverflowTarget)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              >
                <option value="CASCADE">{t("budget.pots.overflow.CASCADE")}</option>
                <option value="UNASSIGNED">{t("budget.pots.overflow.UNASSIGNED")}</option>
                <option value="INVESTMENT">{t("budget.pots.overflow.INVESTMENT")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pot-current" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.currentAmount")}</label>
              <input
                id="pot-current"
                type="number"
                step="0.01"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label htmlFor="pot-target" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.targetAmount")}</label>
              <input
                id="pot-target"
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder={t("budget.pots.optionalPlaceholder")}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pot-monthly" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.monthlyContribution")}</label>
              <input
                id="pot-monthly"
                type="number"
                step="0.01"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label htmlFor="pot-target-date" className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("budget.pots.targetDate")}</label>
              <input
                id="pot-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              />
            </div>
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
              {submitting ? t("common.saving") : pot ? t("common.update") : t("common.create")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
