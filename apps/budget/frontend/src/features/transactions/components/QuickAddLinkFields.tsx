"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { Pot, Plan } from "@/features/budget/types";
import { FIELD_CLASS, FormField } from "@/components/shared/FormField";
import type { QuickAddFormState } from "../hooks/useQuickAddForm";
import { ReceiptPicker } from "./ReceiptPicker";

/** Props of {@link QuickAddLinkFields}. */
export interface QuickAddLinkFieldsProps {
  form: QuickAddFormState;
  pots: Pot[];
  plans: Plan[];
}

/** Optional pot, plan and receipt fields of the quick-add form. */
export function QuickAddLinkFields({ form, pots, plans }: QuickAddLinkFieldsProps) {
  const { t } = useTranslation();
  const noneOption = <option value="">{t("budget.transactions.none")}</option>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="transaction-pot" label={t("budget.transactions.targetPotOptional")}>
          <select
            id="transaction-pot"
            value={form.potId}
            onChange={(e) => form.setPotId(e.target.value)}
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
            value={form.planId}
            onChange={(e) => form.setPlanId(e.target.value)}
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
        <ReceiptPicker file={form.receiptFile} onChange={form.setReceiptFile} />
      </FormField>
    </>
  );
}
