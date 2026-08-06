"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { MaintenanceStep } from "@/shared/types";
import { Check } from "lucide-react";
import { cn } from "@/core/utils";

interface WizardStepContentProps {
  activeStep: MaintenanceStep;
  currentStepIndex: number;
  totalSteps: number;
  doneSteps: Set<number>;
  stepNotes: Record<number, string>;
  handleToggleStepDone: (stepId: number) => void;
  handleNoteChange: (text: string) => void;
  isPending: boolean;
}

export function WizardStepContent({
  activeStep,
  currentStepIndex,
  totalSteps,
  doneSteps,
  stepNotes,
  handleToggleStepDone,
  handleNoteChange,
  isPending,
}: WizardStepContentProps) {
  const t = useTranslations("maintenance");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
          {t("wizardMode.stepCounter", { current: currentStepIndex + 1, total: totalSteps })}
        </span>
        {activeStep && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)]">
            {t("wizardMode.intervalTag", { recurrence: activeStep.recurrence })}
          </span>
        )}
      </div>

      {activeStep && (
        <div className="space-y-4">
          <h3 className="text-2xl font-black uppercase text-[var(--text-main)] tracking-wide">
            {activeStep.title}
          </h3>
          {activeStep.description && (
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              {activeStep.description}
            </p>
          )}
        </div>
      )}

      {/* Checkbox completion */}
      {activeStep && (
        <div className="pt-4">
          <button
            onClick={() => handleToggleStepDone(activeStep.id)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer font-semibold text-sm",
              doneSteps.has(activeStep.id)
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
            disabled={isPending}
          >
            <span>{t("wizardMode.markCompleted")}</span>
            <div className={cn(
              "h-6 w-6 rounded-lg border flex items-center justify-center transition-all",
              doneSteps.has(activeStep.id)
                ? "bg-emerald-500 border-emerald-500 text-black"
                : "border-[var(--border-subtle)]"
            )}>
              {doneSteps.has(activeStep.id) && <Check className="h-4 w-4 stroke-[3]" />}
            </div>
          </button>
        </div>
      )}

      {/* Step specific notes */}
      {activeStep && (
        <div className="space-y-2 pt-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] block">
            {t("wizardMode.operationNotes")}
          </span>
          <textarea
            value={stepNotes[activeStep.id] || ""}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder={t("wizardMode.notesPlaceholder")}
            className="w-full h-32 p-3 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-xs focus:outline-none resize-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
            disabled={isPending}
          />
        </div>
      )}
    </div>
  );
}
