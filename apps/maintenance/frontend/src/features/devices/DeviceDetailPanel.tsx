"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { X, BookOpen, Download, Info, Wrench } from "lucide-react";
import { formatDate, daysUntil } from "@/shared/utils";
import { cn } from "@/shared/utils";

interface DeviceDetailPanelProps {
  device: Device;
  onClose: () => void;
  onStartMaintenance?: (device: Device) => void;
}

type TabType = "overview" | "steps" | "manuals" | "timeline";

export function DeviceDetailPanel({ device, onClose, onStartMaintenance }: DeviceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "steps", label: "Steps" },
    { id: "manuals", label: "Manuals" },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-lg bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md flex flex-col font-sans text-slate-900 dark:text-slate-100 animate-in slide-in-from-right duration-300">
      {/* Panel Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black tracking-widest text-cyan-600 dark:text-cyan-400 uppercase">
            Device Details //
          </span>
          <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100 truncate max-w-xs mt-1">
            {device.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto shrink-0 bg-slate-50 dark:bg-slate-900/50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-3 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
              activeTab === t.id
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 font-black"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            
            {/* Meta Attributes Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Location</span>
                  <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">{device.location}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Model</span>
                  <span className="block text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{device.model}</span>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Serial Key</span>
                  <span className="block text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">{device.serial}</span>
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {device.notes && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Service Notes</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold italic bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  &quot;{device.notes}&quot;
                </p>
              </div>
            )}

            {/* Status Info Block */}
            <div className="p-5 rounded-xl border bg-cyan-500/5 border-cyan-500/10 flex gap-4">
              <Info className="h-5 w-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">Status Monitor</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                  This unit is currently flagged as <strong className="text-cyan-600 dark:text-cyan-400 uppercase">{device.status}</strong>. Scheduled service logs will alert when intervals require inspection.
                </p>
              </div>
            </div>

            {onStartMaintenance && (
              <button
                onClick={() => {
                  onStartMaintenance(device);
                  onClose();
                }}
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10 animate-in fade-in slide-in-from-bottom-2"
              >
                <Wrench className="h-4 w-4" />
                Start Maintenance
              </button>
            )}
          </div>
        )}

        {/* SERVICE STEPS TAB */}
        {activeTab === "steps" && (
          <div className="space-y-4">
            {!device.steps || device.steps.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No maintenance steps defined.</p>
            ) : (
              device.steps.map((step) => {
                const remainingDays = daysUntil(step.supply_needed_date || undefined);
                const isOverdue = remainingDays < 0;

                return (
                  <div key={step.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{step.title}</h4>
                        {step.description && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>}
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                        isOverdue 
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          : remainingDays <= 14
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                      )}>
                        {isOverdue ? `Overdue by ${Math.abs(remainingDays)}d` : `In ${remainingDays}d`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <div className="space-y-0.5">
                        <span>Interval</span>
                        <span className="block text-slate-800 dark:text-slate-300 font-mono">{step.recurrence} Months</span>
                      </div>
                      <div className="space-y-0.5">
                        <span>Last Done</span>
                        <span className="block text-slate-800 dark:text-slate-300 font-mono">{formatDate(step.last_completed || undefined)}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span>Next Due</span>
                        <span className="block text-slate-800 dark:text-slate-300 font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MANUALS TAB */}
        {activeTab === "manuals" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No documentation linked to this device.</p>
          </div>
        )}

        {/* TIMELINE HISTORY TAB */}
        {activeTab === "timeline" && (
          <div className="relative border-l border-slate-200 dark:border-slate-800 pl-4 ml-2 space-y-6">
            {!device.history_events || device.history_events.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No previous operations logged.</p>
            ) : (
              device.history_events.map((event) => {
                const eventTitle = event.completed_steps && event.completed_steps.length > 0
                  ? `Completed: ${event.completed_steps.join(", ")}`
                  : "Maintenance Service";

                return (
                  <div key={event.id} className="relative space-y-2">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 border border-white dark:border-slate-900 ring-4 ring-cyan-500/20" />
                    
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wide">
                          {eventTitle}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <span>{formatDate(event.date)}</span>
                          <span>•</span>
                          <span>By {event.performer}</span>
                        </div>
                      </div>
                    </div>

                    {event.notes && (
                      <p className="text-xs text-slate-700 dark:text-slate-400 leading-relaxed italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
                        &quot;{event.notes}&quot;
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
