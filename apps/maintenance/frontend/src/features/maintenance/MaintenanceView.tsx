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

interface MaintenanceViewProps {
  onStartMaintenance: (device: Device) => void;
}

type MetricFilter = "all" | "overdue" | "due_soon" | "ok";

export function MaintenanceView({ onStartMaintenance }: MaintenanceViewProps) {
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
      <div className="flex items-center justify-center min-h-[50vh] text-cyan-400">
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
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "due_soon":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "ok":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default:
        return "text-slate-400 bg-slate-500/10 border-white/5";
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
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
            filter === "all"
              ? "bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/5 text-white"
              : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Steps</span>
            <Wrench className={cn("h-4.5 w-4.5", filter === "all" ? "text-cyan-400" : "text-slate-500")} />
          </div>
          <span className="text-3xl font-black mt-4 text-white">{totalStepsCount}</span>
        </button>

        {/* Overdue Card */}
        <button
          onClick={() => setFilter("overdue")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
            filter === "overdue"
              ? "bg-red-500/20 border-red-500/40 shadow-lg shadow-red-500/5 text-white"
              : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overdue</span>
            <AlertTriangle className={cn("h-4.5 w-4.5", filter === "overdue" ? "text-red-400" : "text-slate-500")} />
          </div>
          <span className="text-3xl font-black mt-4 text-red-400">{overdueStepsCount}</span>
        </button>

        {/* Due Soon Card */}
        <button
          onClick={() => setFilter("due_soon")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
            filter === "due_soon"
              ? "bg-amber-500/20 border-amber-500/40 shadow-lg shadow-amber-500/5 text-white"
              : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Due Soon</span>
            <Clock className={cn("h-4.5 w-4.5", filter === "due_soon" ? "text-amber-400" : "text-slate-500")} />
          </div>
          <span className="text-3xl font-black mt-4 text-amber-400">{dueSoonStepsCount}</span>
        </button>

        {/* OK Card */}
        <button
          onClick={() => setFilter("ok")}
          className={cn(
            "p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
            filter === "ok"
              ? "bg-emerald-500/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5 text-white"
              : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Good</span>
            <CheckCircle2 className={cn("h-4.5 w-4.5", filter === "ok" ? "text-emerald-400" : "text-slate-500")} />
          </div>
          <span className="text-3xl font-black mt-4 text-emerald-400">{okStepsCount}</span>
        </button>
      </div>

      {/* Main List Layout */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
            Maintenance Schedule //
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 uppercase">
            Showing {filter} ({filteredDevices.length} items)
          </span>
        </div>

        {filteredDevices.length === 0 ? (
          <div className="glass-card rounded-2xl border border-white/10 p-12 text-center max-w-md mx-auto space-y-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">All Clear</h3>
            <p className="text-sm text-slate-400">
              No devices match the selected filter category.
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
                  className="glass-card rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Icon & Meta */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-cyan-400 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">
                        {device.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                        <span className="truncate">{device.location}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">{device.model}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Status & Dates */}
                  <div className="flex flex-wrap items-center gap-4 md:gap-8">
                    {/* Status Badge */}
                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0", getStatusColor(state))}>
                      {state === "ok" ? "good" : state === "due_soon" ? "due soon" : "overdue"}
                    </span>

                    {/* Next Due */}
                    <div className="text-xs">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Next Service Due</span>
                      <span className="font-mono text-slate-300 font-bold">{formatDate(nextDue)}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 ml-auto md:ml-0">
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>
                    <button
                      onClick={() => onStartMaintenance(device)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" />
                      Start
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
