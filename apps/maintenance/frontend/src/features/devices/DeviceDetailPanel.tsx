"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { SidePanel } from "@loeger-os/shared";
import { Info, Wrench } from "lucide-react";
import { formatDate, daysUntil } from "@/shared/utils";
import { cn } from "@/shared/utils";
import { useTranslations } from "next-intl";

interface DeviceDetailPanelProps {
  device: Device;
  onClose: () => void;
  onStartMaintenance?: (device: Device) => void;
}

type TabType = "overview" | "steps" | "manuals" | "timeline";

export function DeviceDetailPanel({ device, onClose, onStartMaintenance }: DeviceDetailPanelProps) {
  const t = useTranslations("maintenance");
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: t("deviceInventory.tabs.overview") },
    { id: "steps", label: t("deviceInventory.tabs.steps") },
    { id: "manuals", label: t("deviceInventory.tabs.manuals") },
    { id: "timeline", label: t("deviceInventory.tabs.timeline") },
  ];

  return (
    <SidePanel
      isOpen={true}
      onClose={onClose}
      title={device.name}
      className="bg-[var(--surface-card)] text-[var(--text-main)] border-l border-[var(--border-subtle)] font-sans"
    >
      <div className="flex flex-col h-full">
        {/* Subheader */}
        <div className="px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)]/50">
          <span className="text-[10px] font-black tracking-widest text-[var(--primary-main)] uppercase">
            {t("deviceInventory.details")}
          </span>
        </div>

        {/* Tabs Navigation */}
        <div className="px-6 border-b border-[var(--border-subtle)] flex gap-2 overflow-x-auto shrink-0 bg-[var(--surface-canvas)]">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setActiveTab(tItem.id)}
              className={cn(
                "px-3 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                activeTab === tItem.id
                  ? "border-[var(--primary-main)] text-[var(--primary-main)] font-black"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
              )}
            >
              {tItem.label}
            </button>
          ))}
        </div>

        {/* Panel Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Meta Attributes Card */}
              <div className="bg-[var(--surface-canvas)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      {t("deviceInventory.fields.location")}
                    </span>
                    <span className="block text-xs font-bold text-[var(--text-main)] uppercase">{device.location}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      {t("deviceInventory.fields.model")}
                    </span>
                    <span className="block text-xs font-mono font-bold text-[var(--text-main)]">{device.model}</span>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      {t("deviceInventory.fields.serialKey")}
                    </span>
                    <span className="block text-xs font-mono font-bold text-[var(--primary-main)]">{device.serial}</span>
                  </div>
                </div>
              </div>

              {/* Notes if present */}
              {device.notes && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {t("deviceInventory.fields.serviceNotes")}
                  </h4>
                  <p className="text-xs text-[var(--text-main)] leading-relaxed font-semibold italic bg-[var(--surface-canvas)] p-4 rounded-xl border border-[var(--border-subtle)]">
                    &quot;{device.notes}&quot;
                  </p>
                </div>
              )}

              {/* Status Info Block */}
              <div className="p-5 rounded-xl border bg-[var(--primary-main)]/5 border-[var(--primary-main)]/10 flex gap-4">
                <Info className="h-5 w-5 text-[var(--primary-main)] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
                    {t("deviceInventory.fields.statusMonitor")}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">
                    {t("deviceInventory.fields.statusFlagged", { status: device.status })}
                  </p>
                </div>
              </div>

              {onStartMaintenance && (
                <button
                  onClick={() => {
                    onStartMaintenance(device);
                    onClose();
                  }}
                  className="w-full py-3.5 rounded-xl bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[var(--primary-main)]/10"
                >
                  <Wrench className="h-4 w-4" />
                  {t("deviceInventory.fields.startMaintenance")}
                </button>
              )}
            </div>
          )}

          {/* SERVICE STEPS TAB */}
          {activeTab === "steps" && (
            <div className="space-y-4">
              {!device.steps || device.steps.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">
                  {t("deviceInventory.fields.noSteps")}
                </p>
              ) : (
                device.steps.map((step) => {
                  const remainingDays = daysUntil(step.supply_needed_date || undefined);
                  const isOverdue = remainingDays < 0;

                  return (
                    <div key={step.id} className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-[var(--text-main)]">{step.title}</h4>
                          {step.description && <p className="text-xs text-[var(--text-muted)] leading-relaxed">{step.description}</p>}
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                          isOverdue 
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : remainingDays <= 14
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]"
                        )}>
                          {isOverdue 
                            ? t("deviceInventory.fields.overdueBy", { days: Math.abs(remainingDays) }) 
                            : t("deviceInventory.fields.dueIn", { days: remainingDays })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        <div className="space-y-0.5">
                          <span>{t("wizard.interval")}</span>
                          <span className="block text-[var(--text-main)] font-mono">
                            {t("deviceInventory.fields.intervalMonths", { count: step.recurrence })}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span>{t("deviceInventory.fields.lastDone")}</span>
                          <span className="block text-[var(--text-main)] font-mono">{formatDate(step.last_completed || undefined)}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span>{t("deviceInventory.fields.nextDue")}</span>
                          <span className="block text-[var(--text-main)] font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
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
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                {t("deviceInventory.fields.noManuals")}
              </p>
            </div>
          )}

          {/* TIMELINE HISTORY TAB */}
          {activeTab === "timeline" && (
            <div className="relative border-l border-[var(--border-subtle)] pl-4 ml-2 space-y-6">
              {!device.history_events || device.history_events.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">
                  {t("deviceInventory.fields.noHistory")}
                </p>
              ) : (
                device.history_events.map((event) => {
                  const eventTitle = event.completed_steps && event.completed_steps.length > 0
                    ? `${t("serviceHistory.completedPrefix")} ${event.completed_steps.join(", ")}`
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
                })
              )}
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
