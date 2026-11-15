"use client";

import React, { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { QuickAddTransactionCreate, TransactionType, Account } from "@/features/budget/types";
import { useFormSubmit } from "@/components/shared/useFormSubmit";
import { ApiError } from "@/core/api";
import { transactionsApi } from "../api/transactionsApi";

/** Currency used when no account is selected; matches the backend default. */
const DEFAULT_CURRENCY = "EUR";

/** Inputs of {@link useQuickAddForm}. */
export interface QuickAddFormOptions {
  open: boolean;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (data: QuickAddTransactionCreate) => Promise<void>;
}

/** Field values and setters of the quick-add form, as returned by {@link useQuickAddForm}. */
export type QuickAddFormState = ReturnType<typeof useQuickAddForm>;

/**
 * Owns the quick-add transaction form: field state, the receipt upload through the backend and
 * the submit flow that resets the form and closes the dialog on success.
 */
export function useQuickAddForm({ open, accounts, onClose, onSubmit }: QuickAddFormOptions) {
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

  // Uploads the receipt (if any) through the backend first and returns the server-generated
  // object key to store on the transaction. OCR extraction is intentionally not wired up here --
  // see issue #529.
  const uploadReceipt = async (file: File): Promise<string> => {
    try {
      const { object_key } = await transactionsApi.uploadReceipt(file);
      return object_key;
    } catch (err) {
      if (err instanceof ApiError && err.status === 413) {
        throw new Error(t("budget.transactions.receiptTooLarge"));
      }
      if (err instanceof ApiError && err.status === 400) {
        throw new Error(t("budget.transactions.receiptInvalidType"));
      }
      if (err instanceof ApiError && err.status !== undefined) {
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

  return {
    description,
    setDescription,
    amount,
    setAmount,
    transactionType,
    setTransactionType,
    accountId,
    setAccountId,
    potId,
    setPotId,
    planId,
    setPlanId,
    receiptFile,
    setReceiptFile,
    currency,
    submitting,
    error,
    handleSubmit,
  };
}
