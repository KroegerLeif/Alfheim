"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, useTranslation } from "@alfheim/shared";
import { QuickAddTransactionCreate, Account, Pot, Plan } from "@/features/budget/types";
import { FormError } from "@/components/shared/FormError";
import { Zap } from "lucide-react";
import { useQuickAddForm } from "../hooks/useQuickAddForm";
import { QuickAddFields } from "./QuickAddFields";
import { QuickAddLinkFields } from "./QuickAddLinkFields";

export interface QuickAddModalProps {
  open: boolean;
  accounts?: Account[];
  pots?: Pot[];
  plans?: Plan[];
  onClose: () => void;
  onSubmit: (data: QuickAddTransactionCreate) => Promise<void>;
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
  const form = useQuickAddForm({ open, accounts, onClose, onSubmit });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="flex items-center gap-2 font-bold text-lg text-[var(--text-main)]">
          <Zap className="w-5 h-5 text-amber-500" />
          <span>{t("budget.transactions.quickAdd")}</span>
        </DialogTitle>

        <form onSubmit={form.handleSubmit} className="space-y-3">
          <QuickAddFields form={form} accounts={accounts} />
          <QuickAddLinkFields form={form} pots={pots} plans={plans} />

          <FormError message={form.error} />

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
              disabled={form.submitting}
              className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {form.submitting ? t("budget.transactions.logging") : t("budget.transactions.quickAdd")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
