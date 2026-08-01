"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getDevices } from "@/shared/api";
import { CATEGORY_ICONS } from "@/shared/data";
import { Device } from "@/shared/types";
import { formatDate, daysUntil } from "@/shared/utils";
import { DeviceDetailPanel } from "../devices/DeviceDetailPanel";
import { 
  Wrench, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Play, 
  Eye, 
  Info,
  Loader2
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useTranslations } from "next-intl";

interface MaintenanceViewProps {
  onStartMaintenance: (device: Device) => void;
}

type MetricFilter = "all" | "overdue" | "due_soon" | "ok";

export function MaintenanceView({ onStartMaintenance }: MaintenanceViewProps) {
  const t = useTranslations("maintenance");
  const { householdId } = useLayout();
  const [filter, setFilter] = useState<MetricFilter>("all");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Fetch devices dynamically
  const { data: householdDevices = [], isLoading } = useQuery({
    queryKey: ["devices", householdId],
    queryFn: () => getDevices(householdId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calculate metrics across the filtered devices
  let totalStepsCount = 0;
  let overdueStepsCount = 0;
  let dueSoonStepsCount = 0;
  let okStepsCount = 0;

  householdDevices.forEach((device) => {
    if (device.steps) {
      device.steps.forEach((step) => {
        totalStepsCount++;
        const remainingDays = daysUntil(step.supply_needed_date || undefined);
        if (remainingDays < 0) {
          overdueStepsCount++;
        } else if (remainingDays <= 14) {
          dueSoonStepsCount++;
        } else {
          okStepsCount++;
        }
      });
    }
  });

  // Helper to categorize a device's maintenance state
  const getDeviceMaintenanceState = (device: Device): MetricFilter => {
    if (!device.steps || device.steps.length === 0) return "ok";
    
    let hasOverdue = false;
    let hasDueSoon = false;

    device.steps.forEach((step) => {
      const remainingDays = daysUntil(step.supply_needed_date || undefined);
      if (remainingDays < 0) {
        hasOverdue = true;
      } else if (remainingDays <= 14) {
        hasDueSoon = true;
      }
    });

    if (hasOverdue) return "overdue";
    if (hasDueSoon) return "due_soon";
    return "ok";
  };

  // Filter devices based on metric card click
  const filteredDevices = householdDevices.filter((device) => {
    if (filter === "all") return true;
    return getDeviceMaintenanceState(device) === filter;
  });

  const getNextServiceDate = (device: Device): string => {
    if (!device.steps || device.steps.length === 0) return "Never";
    const dates = device.steps
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
    <div className="p-6 space-y-8 max-w-7xl mx-auto font-sans">
      
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Card */}
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
            filter === "all"
              ? "bg-[var(--primary-main)]/10 border-[var(--primary-main)]/30 text-[var(--text-main)]"
              : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t("maintenanceWork.totalSteps")}
            </span>
            <Wrench className={cn("h-4.5 w-4.5", filter === "all" ? "text-[var(--primary-main)]" : "text-[var(--text-muted)]")} />
          </div>
          <span className="text-3xl font-black mt-4 text-[var(--text-main)]">{totalStepsCount}</span>
        </button>

        {/* Overdue Card */}
        <button
          onClick={() => setFilter("overdue")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
            filter === "overdue"
              ? "bg-red-500/10 border-red-500/30 text-[var(--text-main)]"
              : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t("maintenanceWork.overdue")}
            </span>
            <AlertTriangle className={cn("h-4.5 w-4.5", filter === "overdue" ? "text-red-500" : "text-[var(--text-muted)]")} />
          </div>
          <span className="text-3xl font-black mt-4 text-red-500">{overdueStepsCount}</span>
        </button>

        {/* Due Soon Card */}
        <button
          onClick={() => setFilter("due_soon")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
            filter === "due_soon"
              ? "bg-amber-500/10 border-amber-500/30 text-[var(--text-main)]"
              : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t("maintenanceWork.dueSoon")}
            </span>
            <Clock className={cn("h-4.5 w-4.5", filter === "due_soon" ? "text-amber-500" : "text-[var(--text-muted)]")} />
          </div>
          <span className="text-3xl font-black mt-4 text-amber-500">{dueSoonStepsCount}</span>
        </button>

        {/* OK Card */}
        <button
          onClick={() => setFilter("ok")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer shadow-sm",
            filter === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-[var(--text-main)]"
              : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t("maintenanceWork.good")}
            </span>
            <CheckCircle2 className={cn("h-4.5 w-4.5", filter === "ok" ? "text-emerald-500" : "text-[var(--text-muted)]")} />
          </div>
          <span className="text-3xl font-black mt-4 text-emerald-500">{okStepsCount}</span>
        </button>
      </div>

      {/* Main List Layout */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
            {t("maintenanceWork.scheduleHeader")}
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)] uppercase">
            {t("maintenanceWork.showingFilter", { filter, count: filteredDevices.length })}
          </span>
        </div>

        {filteredDevices.length === 0 ? (
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
            {filteredDevices.map((device) => {
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

      {/* Slide-over Detail Panel */}
      {selectedDevice && (
        <DeviceDetailPanel
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onStartMaintenance={onStartMaintenance}
        />
      )}
    </div>
  );
}
