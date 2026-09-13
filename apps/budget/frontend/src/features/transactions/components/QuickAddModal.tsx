"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, useTranslation, useLanguage } from "@alfheim/shared";
import { QuickAddTransactionCreate, TransactionType, Account, Pot, Plan } from "@/features/budget/types";
import { Zap } from "lucide-react";

export interface QuickAddModalProps {
  open: boolean;
  accounts?: Account[];
  pots?: Pot[];
  plans?: Plan[];
  onClose: () => void;
  onSubmit: (data: QuickAddTransactionCreate) => Promise<void>;
}

function getCurrencySymbol(locale: string): string {
  const symbols: Record<string, string> = {
    en: "€",
    de: "€",
    pl: "zł",
  };
  return symbols[locale] || "€";
}

export function QuickAddModal({
  open,
  accounts = [],
  pots = [],
  plans = [],
  onClose,
  onSubmit,
}: QuickAddModalProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const currencySymbol = useMemo(() => getCurrencySymbol(language), [language]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [potId, setPotId] = useState("");
  const [planId, setPlanId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        description,
        amount: parsedAmount,
        transaction_type: transactionType,
        account_id: accountId || null,
        pot_id: potId || null,
        plan_id: planId || null,
      });
      setDescription("");
      setAmount("");
      setAccountId("");
      setPotId("");
      setPlanId("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="flex items-center gap-2 font-bold text-lg text-[var(--text-main)]">
          <Zap className="w-5 h-5 text-amber-500" />
          <span>{t("transactions.quickAdd")}</span>
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("transactions.description")}</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("transactions.descriptionPlaceholder")}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                {t("transactions.amount")} ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25.50"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("transactions.type")}</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="EXPENSE">{t("transactions.expense")} (-)</option>
                <option value="INCOME">{t("transactions.income")} (+)</option>
                <option value="TRANSFER">{t("transactions.transfer")} (↔)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("transactions.accountOptional")}</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            >
              <option value="">{t("transactions.none")}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.account_type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("transactions.targetPotOptional")}</label>
              <select
                value={potId}
                onChange={(e) => setPotId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="">{t("transactions.none")}</option>
                {pots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t("transactions.planOptional")}</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="">{t("transactions.none")}</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              {submitting ? t("transactions.logging") : t("transactions.quickAdd")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
