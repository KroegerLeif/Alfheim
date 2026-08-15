"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Device } from "@/shared/types";
import { formatDate } from "@/core/utils";

interface TimelineTabProps {
  device: Device;
}

export function TimelineTab({ device }: TimelineTabProps) {
  const t = useTranslations("maintenance");
  const historyEvents = device.history_events ?? [];

  if (historyEvents.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-8">
        {t("deviceInventory.fields.noHistory")}
      </p>
    );
  }

  return (
    <div className="relative border-l border-[var(--border-subtle)] pl-4 ml-2 space-y-6">
      {historyEvents.map((event) => {
        const completedSteps = event.completed_steps ?? [];
        const eventTitle = completedSteps.length > 0
          ? `${t("serviceHistory.completedPrefix")} ${completedSteps.join(", ")}`
          : t("serviceHistory.maintenanceService");

        return (
          <div key={event.id} className="relative space-y-2">
            {/* Timeline Node Dot */}
            <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary-main)] border border-[var(--surface-card)] ring-4 ring-[var(--primary-main)]/20" />

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">
                  {eventTitle}
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>{formatDate(event.date)}</span>
                  <span>•</span>
                  <span>{t("serviceHistory.byPerformer", { performer: event.performer })}</span>
                </div>
              </div>
            </div>

            {event.notes && (
              <p className="text-xs text-[var(--text-main)] leading-relaxed italic bg-[var(--surface-canvas)] p-2 rounded-lg border border-[var(--border-subtle)] font-mono">
                &quot;{event.notes}&quot;
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
