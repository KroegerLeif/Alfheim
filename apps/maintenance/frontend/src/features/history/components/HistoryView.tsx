"use client";

import React from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { formatDate } from "@/core/utils";
import { CheckCircle2, History, Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useServiceHistory } from "../hooks/useHistory";

export function HistoryView() {
  const t = useTranslations("maintenance");
  const { householdId } = useLayout();

  // Fetch service history using FDD custom hook
  const { data: events = [], isLoading, isError } = useServiceHistory(householdId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-500">Failed to load service history. Please try again.</p>
      </div>
    );
  }

  const eventList = events ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans text-[var(--text-main)]">

      {/* Title Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--primary-main)]" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
            {t("serviceHistory.tagline")}
          </span>
        </div>
        {eventList.length > 0 && (
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {t("serviceHistory.recordCount", { count: eventList.length })}
          </span>
        )}
      </div>

      {/* History Timeline Stream */}
      {eventList.length === 0 ? (
        <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <Info className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
            {t("serviceHistory.noHistoryFound")}
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            {t("serviceHistory.noHistoryDesc")}
          </p>
        </div>
      ) : (
        <div className="relative border-l border-[var(--border-subtle)] pl-6 ml-4 space-y-8 py-2">
          {eventList.map((event) => {
            const completedSteps = event.completed_steps ?? [];
            const eventTitle = completedSteps.length > 0
              ? `${t("serviceHistory.completedPrefix")} ${completedSteps.join(", ")}`
              : t("serviceHistory.maintenanceService");

            return (
              <div key={event.id} className="relative space-y-3">
                {/* Timeline Dot Indicator */}
                <div className="absolute -left-[30px] top-1.5 h-3.5 w-3.5 rounded-full bg-[var(--primary-main)] border-2 border-[var(--surface-canvas)] ring-4 ring-[var(--primary-main)]/10 shrink-0" />

                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wide">
                      {eventTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      <span>{formatDate(event.date)}</span>
                      <span>•</span>
                      <span>{t("serviceHistory.byPerformer", { performer: event.performer })}</span>
                      <span>•</span>
                      <span className="text-[var(--primary-main)] font-bold">{event.device_name}</span>
                      <span>({event.device_location})</span>
                    </div>
                  </div>
                </div>

                {/* Completed Steps Chips */}
                {completedSteps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {completedSteps.map((step, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {step}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes Block */}
                {event.notes && (
                  <p className="text-xs text-[var(--text-main)] leading-relaxed italic bg-[var(--surface-canvas)] p-3 rounded-xl border border-[var(--border-subtle)] max-w-2xl font-mono">
                    &quot;{event.notes}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
