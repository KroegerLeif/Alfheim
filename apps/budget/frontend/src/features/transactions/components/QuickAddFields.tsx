"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { TransactionType, Account } from "@/features/budget/types";
import { FIELD_CLASS, FormField } from "@/components/shared/FormField";
import { accountTypeLabel } from "@/features/accounts/accountTypes";
import type { QuickAddFormState } from "../hooks/useQuickAddForm";

/** Props of {@link QuickAddFields}. */
export interface QuickAddFieldsProps {
  form: QuickAddFormState;
  accounts: Account[];
}

/** Description, amount, type and account fields of the quick-add form. */
export function QuickAddFields({ form, accounts }: QuickAddFieldsProps) {
  const { t } = useTranslation();
  const noneOption = <option value="">{t("budget.transactions.none")}</option>;

  return (
    <>
      <FormField id="transaction-description" label={t("budget.transactions.description")}>
        <input
          id="transaction-description"
          type="text"
          required
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder={t("budget.transactions.descriptionPlaceholder")}
          className={FIELD_CLASS}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="transaction-amount" label={t("budget.transactions.amountWithCurrency", { currency: form.currency })}>
          <input
            id="transaction-amount"
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => form.setAmount(e.target.value)}
            placeholder="25.50"
            className={`${FIELD_CLASS} font-mono`}
          />
        </FormField>
        <FormField id="transaction-type" label={t("budget.transactions.type")}>
          <select
            id="transaction-type"
            value={form.transactionType}
            onChange={(e) => form.setTransactionType(e.target.value as TransactionType)}
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
          value={form.accountId}
          onChange={(e) => form.setAccountId(e.target.value)}
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
    </>
  );
}
