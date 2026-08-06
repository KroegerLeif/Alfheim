"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Device } from "@/shared/types";
import { CATEGORY_ICONS } from "@/shared/data";
import { formatDate, daysUntil } from "@/core/utils";
import { cn } from "@/core/utils";
import { Eye, Play, Info, CheckCircle2 } from "lucide-react";

type MetricFilter = "all" | "overdue" | "due_soon" | "ok";

interface DeviceMaintenanceListProps {
  filteredDevices: Device[];
  filter: MetricFilter;
  getDeviceMaintenanceState: (d: Device) => MetricFilter;
  setSelectedDevice: (d: Device) => void;
  onStartMaintenance: (d: Device) => void;
}

export function DeviceMaintenanceList({
  filteredDevices = [],
  filter,
  getDeviceMaintenanceState,
  setSelectedDevice,
  onStartMaintenance,
}: DeviceMaintenanceListProps) {
  const t = useTranslations("maintenance");
  const list = filteredDevices ?? [];

  const getNextServiceDate = (device: Device): string => {
    const steps = device.steps ?? [];
    if (steps.length === 0) return "Never";
    const dates = steps
      .map((s) => s.supply_needed_date)
      .filter((d): d is string => !!d);
    if (dates.length === 0) return "Never";
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  };

  const getStatusColor = (state: MetricFilter) => {
    switch (state) {
      case "overdue":
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case "due_soon":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "ok":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      default:
        return "text-[var(--text-muted)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
          {t("maintenanceWork.scheduleHeader")}
        </span>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] uppercase">
          {t("maintenanceWork.showingFilter", { filter, count: list.length })}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
            {t("maintenanceWork.allClear")}
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            {t("maintenanceWork.noMatchFilter")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((device) => {
            const state = getDeviceMaintenanceState(device);
            const nextDue = getNextServiceDate(device);
            const Icon = CATEGORY_ICONS[device.category as keyof typeof CATEGORY_ICONS] || Info;

            return (
              <div
                key={device.id}
                className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl p-4 border hover:border-[var(--border-accent)] transition-all shadow-sm grid grid-cols-1 md:grid-cols-12 md:items-center gap-4"
              >
                {/* Cols 1–5: Icon & Device Info */}
                <div className="col-span-12 md:col-span-5 flex items-center gap-4 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)] shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wide truncate">
                      {device.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                      <span className="truncate">{device.location}</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">{device.model}</span>
                    </div>
                  </div>
                </div>

                {/* Cols 6–7: Status Badge */}
                <div className="col-span-6 md:col-span-2 flex items-center justify-start md:justify-center">
                  <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0", getStatusColor(state))}>
                    {state === "ok" ? t("maintenanceWork.statusGood") : state === "due_soon" ? t("maintenanceWork.statusDueSoon") : t("maintenanceWork.statusOverdue")}
                  </span>
                </div>

                {/* Cols 8–9: Next Service Due Date */}
                <div className="col-span-6 md:col-span-2 text-left md:text-center text-xs">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {t("maintenanceWork.nextServiceDue")}
                  </span>
                  <span className="font-mono text-[var(--text-main)] font-bold">{formatDate(nextDue)}</span>
                </div>

                {/* Cols 10–12: Action Buttons */}
                <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setSelectedDevice(device)}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t("maintenanceWork.detailsBtn")}
                  </button>
                  <button
                    onClick={() => onStartMaintenance(device)}
                    className="px-4 py-2 rounded-xl bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[var(--primary-main)]/10"
                  >
                    <Play className="h-3.5 w-3.5 fill-black" />
                    {t("maintenanceWork.startBtn")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
