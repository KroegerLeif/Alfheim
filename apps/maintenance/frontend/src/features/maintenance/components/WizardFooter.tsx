"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/core/utils";

interface WizardFooterProps {
  currentStepIndex: number;
  totalSteps: number;
  isWizardComplete: boolean;
  isPending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}

/** Back / Next / Finish controls of the maintenance wizard. */
export function WizardFooter({
  currentStepIndex,
  totalSteps,
  isWizardComplete,
  isPending,
  onPrev,
  onNext,
  onFinish,
}: WizardFooterProps) {
  const t = useTranslations("maintenance");
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between gap-4 pt-8 mt-auto">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst || isPending}
        className={cn(
          "px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
          isFirst
            ? "border-[var(--border-subtle)] text-[var(--text-muted)]/40 cursor-not-allowed"
            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("wizardMode.back")}
      </button>

      {isLast ? (
        <button
          type="button"
          onClick={onFinish}
          disabled={!isWizardComplete || isPending}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
            isWizardComplete && !isPending
              ? "bg-emerald-500 text-black hover:bg-emerald-600 shadow-emerald-500/10"
              : "bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed"
          )}
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("wizardMode.saving")}</>
          ) : (
            <><Check className="h-4 w-4 stroke-[3]" /> {t("wizardMode.finishAndSave")}</>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[var(--primary-main)]/10"
        >
          {t("wizardMode.next")}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
