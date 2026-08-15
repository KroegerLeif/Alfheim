"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Device } from "@/shared/types";
import { formatDate, daysUntil } from "@/core/utils";
import { cn } from "@/core/utils";

interface StepsTabProps {
  device: Device;
}

export function StepsTab({ device }: StepsTabProps) {
  const t = useTranslations("maintenance");
  const steps = device.steps ?? [];

  if (steps.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-8">
        {t("deviceInventory.fields.noSteps")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step) => {
        const remainingDays = daysUntil(step.supply_needed_date || undefined);
        const isOverdue = remainingDays < 0;

        return (
          <div key={step.id} className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--text-main)]">{step.title}</h4>
                {step.description && <p className="text-xs text-[var(--text-muted)] leading-relaxed">{step.description}</p>}
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                isOverdue
                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                  : remainingDays <= 14
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]"
              )}>
                {isOverdue
                  ? t("deviceInventory.fields.overdueBy", { days: Math.abs(remainingDays) })
                  : t("deviceInventory.fields.dueIn", { days: remainingDays })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <div className="space-y-0.5">
                <span>{t("wizard.interval")}</span>
                <span className="block text-[var(--text-main)] font-mono">
                  {t("deviceInventory.fields.intervalMonths", { count: step.recurrence })}
                </span>
              </div>
              <div className="space-y-0.5">
                <span>{t("deviceInventory.fields.lastDone")}</span>
                <span className="block text-[var(--text-main)] font-mono">{formatDate(step.last_completed || undefined)}</span>
              </div>
              <div className="space-y-0.5">
                <span>{t("deviceInventory.fields.nextDue")}</span>
                <span className="block text-[var(--text-main)] font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
