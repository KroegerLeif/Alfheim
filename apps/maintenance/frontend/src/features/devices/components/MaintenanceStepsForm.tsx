"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CreateStepPayload } from "@/shared/types";
import { Plus, Trash2 } from "lucide-react";

interface MaintenanceStepsFormProps {
  steps: CreateStepPayload[];
  handleAddStep: () => void;
  handleRemoveStep: (idx: number) => void;
  handleStepChange: <K extends keyof CreateStepPayload>(
    idx: number,
    field: K,
    value: CreateStepPayload[K]
  ) => void;
}

export function MaintenanceStepsForm({
  steps = [],
  handleAddStep,
  handleRemoveStep,
  handleStepChange,
}: MaintenanceStepsFormProps) {
  const t = useTranslations("maintenance");
  const stepList = steps ?? [];

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between">
        <legend className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {t("wizard.stepsLegend")}
        </legend>
        <button
          type="button"
          onClick={handleAddStep}
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--primary-main)] hover:opacity-80 transition-colors px-2.5 py-1 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20"
        >
          <Plus className="h-3 w-3" />
          {t("wizard.addStep")}
        </button>
      </div>

      {stepList.map((step, idx) => (
        <div
          key={idx}
          className="p-4 bg-[var(--surface-canvas)] rounded-xl border border-[var(--border-subtle)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {t("wizard.stepNumber", { number: idx + 1 })}
            </span>
            {stepList.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveStep(idx)}
                className="h-6 w-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.title")}
              </span>
              <input
                value={step.title}
                onChange={(e) => handleStepChange(idx, "title", e.target.value)}
                placeholder={t("wizard.titlePlaceholder")}
                className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.supplyItem")}
              </span>
              <input
                value={step.supply_item ?? ""}
                onChange={(e) => handleStepChange(idx, "supply_item", e.target.value || null)}
                placeholder={t("wizard.supplyPlaceholder")}
                className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.recurrence")}
              </span>
              <input
                type="number"
                min={1}
                max={120}
                value={step.recurrence}
                onChange={(e) => handleStepChange(idx, "recurrence", Number(e.target.value))}
                className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all font-mono"
              />
            </label>
            <label className="space-y-1 block sm:col-span-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.description")}
              </span>
              <input
                value={step.description ?? ""}
                onChange={(e) => handleStepChange(idx, "description", e.target.value || null)}
                placeholder={t("wizard.descriptionPlaceholder")}
                className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
              />
            </label>
          </div>
        </div>
      ))}
    </fieldset>
  );
}
