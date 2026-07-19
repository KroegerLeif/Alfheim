"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { X, BookOpen, Calendar, DollarSign, Wrench, Clock, User, Download, Info } from "lucide-react";
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
    { id: "steps", label: "Service Steps" },
    { id: "manuals", label: "Manuals" },
    { id: "timeline", label: "History" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-950">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              Device Details //
            </span>
            <h2 className="text-lg font-black uppercase text-white truncate max-w-[320px]">
              {device.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close panel"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 bg-slate-950 px-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                  isActive
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Model Number</span>
                  <p className="text-sm font-semibold text-white font-mono">{device.model}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Serial Number</span>
                  <p className="text-sm font-semibold text-white font-mono">{device.serialNumber}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Location</span>
                  <p className="text-sm font-semibold text-white">{device.location}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Category</span>
                  <p className="text-sm font-semibold text-white">{device.category}</p>
                </div>
              </div>

              {/* Assigned User */}
              {device.assignedUser && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Assigned Maintainer</span>
                    <span className="text-sm font-bold text-white">{device.assignedUser.name}</span>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              )}

              {/* Status Info Block */}
              <div className="p-5 rounded-xl border bg-cyan-500/5 border-cyan-500/10 flex gap-4">
                <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Status Monitor</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This unit is currently flagged as <strong className="text-cyan-300 uppercase">{device.status}</strong>. Scheduled service logs will alert when intervals require inspection.
                  </p>
                </div>
              </div>

              {onStartMaintenance && (
                <button
                  onClick={() => {
                    onStartMaintenance(device);
                    onClose();
                  }}
                  className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10 animate-in fade-in slide-in-from-bottom-2"
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
              {!device.serviceSteps || device.serviceSteps.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No maintenance steps defined.</p>
              ) : (
                device.serviceSteps.map((step) => {
                  const remainingDays = daysUntil(step.nextDue);
                  const isOverdue = remainingDays < 0;

                  return (
                    <div key={step.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">{step.name}</h4>
                          {step.description && <p className="text-xs text-slate-400">{step.description}</p>}
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                          isOverdue 
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : remainingDays <= 14
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-white/5 text-slate-400 border-white/5"
                        )}>
                          {isOverdue ? `Overdue by ${Math.abs(remainingDays)}d` : `In ${remainingDays}d`}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <div className="space-y-0.5">
                          <span>Interval</span>
                          <span className="block text-slate-300 font-mono">{step.intervalMonths} Months</span>
                        </div>
                        <div className="space-y-0.5">
                          <span>Last Done</span>
                          <span className="block text-slate-300 font-mono">{formatDate(step.lastPerformed)}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span>Next Due</span>
                          <span className="block text-slate-300 font-mono">{formatDate(step.nextDue)}</span>
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
              {!device.manuals || device.manuals.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No documentation linked to this device.</p>
              ) : (
                device.manuals.map((man) => (
                  <div key={man.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400 shrink-0">
                        <BookOpen className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{man.title}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">{man.fileSize}</span>
                      </div>
                    </div>
                    <a
                      href={man.url}
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TIMELINE HISTORY TAB */}
          {activeTab === "timeline" && (
            <div className="relative border-l border-white/5 pl-4 ml-2 space-y-6">
              {!device.serviceHistory || device.serviceHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No previous operations logged.</p>
              ) : (
                device.serviceHistory.map((event) => (
                  <div key={event.id} className="relative space-y-2">
                    {/* Timeline Node dot */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400 border border-slate-900 ring-4 ring-cyan-400/20" />
                    
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <span>{formatDate(event.performedAt)}</span>
                          <span>•</span>
                          <span>By {event.performedBy}</span>
                        </div>
                      </div>
                      {event.cost !== undefined && event.cost > 0 && (
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          -${event.cost.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {event.notes && (
                      <p className="text-xs text-slate-400 leading-relaxed italic">
                        "{event.notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
