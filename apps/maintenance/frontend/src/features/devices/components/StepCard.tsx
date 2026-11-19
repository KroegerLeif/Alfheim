"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { MaintenanceStep } from "@/shared/types";
import { cn } from "@alfheim/shared";
import { daysUntil, dueStatusFromDays } from "@/core/utils";
import { useFormatDate } from "@/core/useFormatDate";

const BADGE_CLASS = {
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
  due_soon: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  ok: "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]",
  unscheduled: "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]",
} as const;

interface StepCardProps {
  step: MaintenanceStep;
  /** Edit and delete controls, shown to writers only. */
  actions?: React.ReactNode;
}

/** One maintenance step of a device with its due status, interval and dates. */
export function StepCard({ step, actions }: StepCardProps) {
  const t = useTranslations("maintenance");
  const formatDate = useFormatDate();
  const remainingDays = daysUntil(step.supply_needed_date);
  const status = dueStatusFromDays(remainingDays);
  const badgeText =
    remainingDays === null
      ? t("dates.notScheduled")
      : remainingDays < 0
        ? t("deviceInventory.fields.overdueBy", { days: Math.abs(remainingDays) })
        : t("deviceInventory.fields.dueIn", { days: remainingDays });

  return (
    <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-bold text-[var(--text-main)] break-words">{step.title}</h4>
          {step.description && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed break-words whitespace-pre-line">{step.description}</p>
          )}
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0", BADGE_CLASS[status])}>
          {badgeText}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <div className="space-y-0.5 min-w-0">
          <span>{t("wizard.interval")}</span>
          <span className="block text-[var(--text-main)] font-mono">
            {t("deviceInventory.fields.intervalMonths", { count: step.recurrence })}
          </span>
        </div>
        <div className="space-y-0.5 min-w-0">
          <span>{t("deviceInventory.fields.lastDone")}</span>
          <span className="block text-[var(--text-main)] font-mono">{formatDate(step.last_completed, "never")}</span>
        </div>
        <div className="space-y-0.5 min-w-0">
          <span>{t("deviceInventory.fields.nextDue")}</span>
          <span className="block text-[var(--text-main)] font-mono">{formatDate(step.supply_needed_date)}</span>
        </div>
      </div>

      {actions && <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">{actions}</div>}
    </div>
  );
}
