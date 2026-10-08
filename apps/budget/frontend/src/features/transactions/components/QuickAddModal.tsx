"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, useTranslation } from "@alfheim/shared";
import { QuickAddTransactionCreate, TransactionType, Account, Pot, Plan } from "@/features/budget/types";
import { FIELD_CLASS, FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";
import { useFormSubmit } from "@/components/shared/useFormSubmit";
import { accountTypeLabel } from "@/features/accounts/accountTypes";
import { transactionsApi, ReceiptUploadError } from "../api/transactionsApi";
import { ReceiptPicker } from "./ReceiptPicker";
import { Zap } from "lucide-react";

export interface QuickAddModalProps {
  open: boolean;
  accounts?: Account[];
  pots?: Pot[];
  plans?: Plan[];
  onClose: () => void;
  onSubmit: (data: QuickAddTransactionCreate) => Promise<void>;
}

/** Currency used when no account is selected; matches the backend default. */
const DEFAULT_CURRENCY = "EUR";

export function QuickAddModal({
  open,
  accounts = [],
  pots = [],
  plans = [],
  onClose,
  onSubmit,
}: QuickAddModalProps) {
  const { t } = useTranslation();
  const { submitting, error, run } = useFormSubmit(open);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [potId, setPotId] = useState("");
  const [planId, setPlanId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // The amount is booked in the selected account's currency, never in a currency implied by the
  // UI language.
  const currency = (accounts ?? []).find((acc) => acc.id === accountId)?.currency ?? DEFAULT_CURRENCY;

  if (!open) return null;

  // Uploads the receipt (if any) to RustFS/S3 first and returns the object key to store on the
  // transaction. OCR extraction is intentionally not wired up here -- see issue #529.
  const uploadReceipt = async (file: File): Promise<string> => {
    try {
      const { upload_url, object_key } = await transactionsApi.getReceiptUploadUrl(
        file.name,
        file.type || "image/jpeg"
      );
      await transactionsApi.uploadReceiptFile(upload_url, file);
      return object_key;
    } catch (err) {
      if (err instanceof ReceiptUploadError) {
        throw new Error(t("budget.transactions.receiptUploadFailed", { status: err.status }));
      }
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const saved = await run(async () => {
      const receiptUrl = receiptFile ? await uploadReceipt(receiptFile) : null;
      await onSubmit({
        description,
        amount: parsedAmount,
        currency,
        transaction_type: transactionType,
        account_id: accountId || null,
        pot_id: potId || null,
        plan_id: planId || null,
        receipt_url: receiptUrl,
      });
    });
    if (!saved) return;
    setDescription("");
    setAmount("");
    setAccountId("");
    setPotId("");
    setPlanId("");
    setReceiptFile(null);
    onClose();
  };

  const noneOption = <option value="">{t("budget.transactions.none")}</option>;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="flex items-center gap-2 font-bold text-lg text-[var(--text-main)]">
          <Zap className="w-5 h-5 text-amber-500" />
          <span>{t("budget.transactions.quickAdd")}</span>
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField id="transaction-description" label={t("budget.transactions.description")}>
            <input
              id="transaction-description"
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("budget.transactions.descriptionPlaceholder")}
              className={FIELD_CLASS}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="transaction-amount" label={t("budget.transactions.amountWithCurrency", { currency })}>
              <input
                id="transaction-amount"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25.50"
                className={`${FIELD_CLASS} font-mono`}
              />
            </FormField>
            <FormField id="transaction-type" label={t("budget.transactions.type")}>
              <select
                id="transaction-type"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className={FIELD_CLASS}
              >
                <option value="EXPENSE">{t("budget.transactions.expense")} (-)</option>
                <option value="INCOME">{t("budget.transactions.income")} (+)</option>
                <option value="TRANSFER">{t("budget.transactions.transfer")} (↔)</option>
              </select>
            </FormField>
          </div>

          <FormField id="transaction-account" label={t("budget.transactions.accountOptional")}>
            <select
              id="transaction-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={FIELD_CLASS}
            >
              {noneOption}
              {(accounts ?? []).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({accountTypeLabel(acc.account_type, t)})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="transaction-pot" label={t("budget.transactions.targetPotOptional")}>
              <select
                id="transaction-pot"
                value={potId}
                onChange={(e) => setPotId(e.target.value)}
                className={FIELD_CLASS}
              >
                {noneOption}
                {(pots ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="transaction-plan" label={t("budget.transactions.planOptional")}>
              <select
                id="transaction-plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className={FIELD_CLASS}
              >
                {noneOption}
                {(plans ?? []).map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField id="transaction-receipt" label={t("budget.transactions.receiptUpload")}>
            <ReceiptPicker file={receiptFile} onChange={setReceiptFile} />
          </FormField>

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
              {submitting ? t("budget.transactions.logging") : t("budget.transactions.quickAdd")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
