"use client";

import React, { useState } from "react";
import { Device, MaintenanceStep } from "@/shared/types";
import { ScheduledTaskItem } from "./ScheduledTaskItem";
import { CalendarRange, Info, Loader2 } from "lucide-react";
import { cn, daysUntil, UPCOMING_WINDOW_DAYS } from "@/core/utils";
import { useTranslations } from "next-intl";
import { useDevices } from "@/features/devices";

interface FlattenedTask {
  step: MaintenanceStep;
  device: Device;
}

export function ScheduledView() {
  const t = useTranslations("maintenance");
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

  // Fetch devices using hook from devices barrel export
  const { data: devices, isLoading, isError } = useDevices();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Flatten steps from all filtered devices, ensuring array safety
  const allTasks: FlattenedTask[] = [];
  const deviceList = devices ?? [];

  deviceList.forEach((device) => {
    const steps = device.steps ?? [];
    steps.forEach((step) => {
      allTasks.push({ step, device });
    });
  });

  // Sort them chronologically by supply_needed_date (null or undefined last)
  allTasks.sort((a, b) => {
    const dateA = a.step.supply_needed_date || "9999-12-31";
    const dateB = b.step.supply_needed_date || "9999-12-31";
    return dateA.localeCompare(dateB);
  });

  // Filter tasks based on "Upcoming" (overdue or due within the window) or "All Tasks".
  // Steps without a due date are not upcoming, they only show under "All Tasks".
  const visibleTasks = allTasks.filter((task) => {
    if (filter === "all") return true;
    const remainingDays = daysUntil(task.step.supply_needed_date);
    return remainingDays !== null && remainingDays <= UPCOMING_WINDOW_DAYS;
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans">
      {isError && (
        <div role="alert" className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          {t("deviceInventory.loadError")}
        </div>
      )}

      {/* Toggle Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-[var(--primary-main)]" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
            {t("scheduledTasks.tagline")}
          </span>
        </div>

        {/* View Filter Toggles */}
        <div className="flex bg-[var(--surface-canvas)] rounded-xl p-1 border border-[var(--border-subtle)] shrink-0">
          <button
            type="button"
            aria-pressed={filter === "upcoming"}
            onClick={() => setFilter("upcoming")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
              filter === "upcoming"
                ? "bg-[var(--primary-main)] text-black shadow-md"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
          >
            {t("scheduledTasks.upcoming30d")}
          </button>
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
              filter === "all"
                ? "bg-[var(--primary-main)] text-black shadow-md"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
          >
            {t("scheduledTasks.allTasks")}
          </button>
        </div>
      </div>

      {/* Task List Stream */}
      {visibleTasks.length === 0 ? (
        !isError && (
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <Info className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
            <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
              {t("scheduledTasks.noTasksScheduled")}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{t("scheduledTasks.noTasksDesc")}</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {visibleTasks.map(({ step, device }) => (
            <ScheduledTaskItem
              key={`${device.id}-${step.id}`}
              step={step}
              device={device}
            />
          ))}
        </div>
      )}

    </div>
  );
}
