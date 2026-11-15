"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { CreateStepPayload, MaintenanceStep } from "@/shared/types";

interface StepFormProps {
  /** Step to edit; a new step starts empty. */
  step?: MaintenanceStep;
  onSubmit: (payload: CreateStepPayload) => void;
  onCancel: () => void;
  isPending: boolean;
  isError: boolean;
}

const INPUT_CLASS =
  "w-full p-2.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none";
const LABEL_CLASS = "text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]";

/** Adds a maintenance step to a device or edits one (#505). */
export function StepForm({ step, onSubmit, onCancel, isPending, isError }: StepFormProps) {
  const t = useTranslations("maintenance");
  const [title, setTitle] = useState(step?.title ?? "");
  const [description, setDescription] = useState(step?.description ?? "");
  const [recurrence, setRecurrence] = useState(step?.recurrence ?? 12);
  const [supplyItem, setSupplyItem] = useState(step?.supply_item ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      recurrence,
      supply_item: supplyItem.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={step ? t("deviceInventory.edit.editStep") : t("wizard.addStep")}
      className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--primary-main)]/30 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1 sm:col-span-2">
          <span className={LABEL_CLASS}>{t("wizard.title")} *</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("wizard.titlePlaceholder")} className={INPUT_CLASS} />
        </label>
        <label className="space-y-1">
          <span className={LABEL_CLASS}>{t("wizard.recurrence")}</span>
          <input type="number" min={1} max={600} required value={recurrence} onChange={(e) => setRecurrence(Number(e.target.value))} className={`${INPUT_CLASS} font-mono`} />
        </label>
      </div>
      <label className="space-y-1 block">
        <span className={LABEL_CLASS}>{t("wizard.description")}</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("wizard.descriptionPlaceholder")} className={`${INPUT_CLASS} resize-none`} />
      </label>
      <label className="space-y-1 block">
        <span className={LABEL_CLASS}>{t("wizard.supplyItem")}</span>
        <input value={supplyItem} onChange={(e) => setSupplyItem(e.target.value)} placeholder={t("wizard.supplyPlaceholder")} className={INPUT_CLASS} />
      </label>
      {isError && (
        <p role="alert" className="text-xs text-red-500">
          {t("deviceInventory.edit.saveError")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-bold uppercase text-[var(--text-muted)] cursor-pointer">
          {t("wizard.cancel")}
        </button>
        <button type="submit" disabled={isPending || !title.trim() || recurrence < 1} className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-black text-xs font-black uppercase disabled:opacity-50 cursor-pointer">
          {isPending ? t("wizard.saving") : t("deviceInventory.edit.save")}
        </button>
      </div>
    </form>
  );
}
