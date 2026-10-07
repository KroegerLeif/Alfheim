"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Wrench, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/core/utils";
import { MetricFilter } from "../utils";

interface MaintenanceMetricsProps {
  filter: MetricFilter;
  setFilter: (f: MetricFilter) => void;
  totalStepsCount: number;
  overdueStepsCount: number;
  dueSoonStepsCount: number;
  okStepsCount: number;
}

export function MaintenanceMetrics({
  filter,
  setFilter,
  totalStepsCount,
  overdueStepsCount,
  dueSoonStepsCount,
  okStepsCount,
}: MaintenanceMetricsProps) {
  const t = useTranslations("maintenance");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Card */}
      <button
        type="button"
        aria-pressed={filter === "all"}
        onClick={() => setFilter("all")}
        className={cn(
          "min-w-0 p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
          filter === "all"
            ? "bg-[var(--primary-main)]/10 border-[var(--primary-main)]/30 text-[var(--text-main)]"
            : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
        )}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {t("maintenanceWork.totalSteps")}
          </span>
          <Wrench className={cn("h-4.5 w-4.5 shrink-0", filter === "all" ? "text-[var(--primary-main)]" : "text-[var(--text-muted)]")} />
        </div>
        <span className="text-3xl font-black mt-4 text-[var(--text-main)]">{totalStepsCount}</span>
      </button>

      {/* Overdue Card */}
      <button
        type="button"
        aria-pressed={filter === "overdue"}
        onClick={() => setFilter("overdue")}
        className={cn(
          "min-w-0 p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
          filter === "overdue"
            ? "bg-red-500/10 border-red-500/30 text-[var(--text-main)]"
            : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
        )}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {t("maintenanceWork.overdue")}
          </span>
          <AlertTriangle className={cn("h-4.5 w-4.5 shrink-0", filter === "overdue" ? "text-red-500" : "text-[var(--text-muted)]")} />
        </div>
        <span className="text-3xl font-black mt-4 text-red-500">{overdueStepsCount}</span>
      </button>

      {/* Due Soon Card */}
      <button
        type="button"
        aria-pressed={filter === "due_soon"}
        onClick={() => setFilter("due_soon")}
        className={cn(
          "min-w-0 p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
          filter === "due_soon"
            ? "bg-amber-500/10 border-amber-500/30 text-[var(--text-main)]"
            : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
        )}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {t("maintenanceWork.dueSoon")}
          </span>
          <Clock className={cn("h-4.5 w-4.5 shrink-0", filter === "due_soon" ? "text-amber-500" : "text-[var(--text-muted)]")} />
        </div>
        <span className="text-3xl font-black mt-4 text-amber-500">{dueSoonStepsCount}</span>
      </button>

      {/* OK Card */}
      <button
        type="button"
        aria-pressed={filter === "ok"}
        onClick={() => setFilter("ok")}
        className={cn(
          "min-w-0 p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
          filter === "ok"
            ? "bg-emerald-500/10 border-emerald-500/30 text-[var(--text-main)]"
            : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
        )}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {t("maintenanceWork.good")}
          </span>
          <CheckCircle2 className={cn("h-4.5 w-4.5 shrink-0", filter === "ok" ? "text-emerald-500" : "text-[var(--text-muted)]")} />
        </div>
        <span className="text-3xl font-black mt-4 text-emerald-500">{okStepsCount}</span>
      </button>
    </div>
  );
}
