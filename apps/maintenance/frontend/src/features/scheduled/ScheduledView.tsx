"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { initialDevices } from "@/shared/data";
import { Device, ServiceStep } from "@/shared/types";
import { ScheduledTaskItem } from "./ScheduledTaskItem";
import { CalendarRange, Info } from "lucide-react";
import { cn } from "@/shared/utils";
import { daysUntil } from "@/shared/utils";

interface FlattenedTask {
  step: ServiceStep;
  device: Device;
}

export function ScheduledView() {
  const { householdId } = useLayout();
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

  // Filter devices based on household selection
  const filteredDevices = initialDevices.filter(
    (d) => householdId === null || d.householdId === householdId
  );

  // Flatten steps from all filtered devices
  const allTasks: FlattenedTask[] = [];
  filteredDevices.forEach((device) => {
    if (device.serviceSteps) {
      device.serviceSteps.forEach((step) => {
        allTasks.push({ step, device });
      });
    }
  });

  // Sort them chronologically by computed nextDue date (null or undefined last)
  allTasks.sort((a, b) => {
    const dateA = a.step.nextDue || "9999-12-31";
    const dateB = b.step.nextDue || "9999-12-31";
    return dateA.localeCompare(dateB);
  });

  // Filter tasks based on "Upcoming" (due <= 30 days) or "All Tasks"
  const visibleTasks = allTasks.filter((task) => {
    if (filter === "all") return true;
    const remainingDays = daysUntil(task.step.nextDue);
    return remainingDays <= 30; // Includes overdue and next 30 days
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans">
      
      {/* Toggle Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-cyan-400" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
            Task Planner //
          </span>
        </div>

        {/* View Filter Toggles */}
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5 shrink-0">
          <button
            onClick={() => setFilter("upcoming")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
              filter === "upcoming"
                ? "bg-cyan-500 text-black shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            Upcoming (30d)
          </button>
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
              filter === "all"
                ? "bg-cyan-500 text-black shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            All Tasks
          </button>
        </div>
      </div>

      {/* Task List Stream */}
      {visibleTasks.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/10 p-12 text-center max-w-md mx-auto space-y-4">
          <Info className="h-10 w-10 text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">No Tasks Scheduled</h3>
          <p className="text-sm text-slate-400">
            There are no checklist tasks matching your filter for this location.
          </p>
        </div>
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
