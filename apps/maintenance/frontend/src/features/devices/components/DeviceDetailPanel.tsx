"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { SidePanel } from "@alfheim/shared";
import { useTranslations } from "next-intl";
import { cn } from "@/core/utils";
import { OverviewTab } from "./OverviewTab";
import { StepsTab } from "./StepsTab";
import { TimelineTab } from "./TimelineTab";

interface DeviceDetailPanelProps {
  device: Device;
  onClose: () => void;
  onStartMaintenance?: (device: Device) => void;
}

type TabType = "overview" | "steps" | "timeline";

export function DeviceDetailPanel({ device, onClose, onStartMaintenance }: DeviceDetailPanelProps) {
  const t = useTranslations("maintenance");
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: t("deviceInventory.tabs.overview") },
    { id: "steps", label: t("deviceInventory.tabs.steps") },
    { id: "timeline", label: t("deviceInventory.tabs.timeline") },
  ];

  return (
    <SidePanel
      isOpen={true}
      onClose={onClose}
      // The shared panel header does not shrink its title, so cap the width and let long names wrap.
      title={<span className="block max-w-[calc(100vw-5rem)] md:max-w-[22rem] [overflow-wrap:anywhere]">{device.name}</span>}
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
        <div role="tablist" className="px-6 border-b border-[var(--border-subtle)] flex gap-2 overflow-x-auto shrink-0 bg-[var(--surface-canvas)]">
          {tabs.map((tItem) => (
            <button
              key={tItem.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tItem.id}
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
        <div role="tabpanel" className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "overview" && (
            <OverviewTab
              device={device}
              onStartMaintenance={onStartMaintenance}
              onClose={onClose}
            />
          )}

          {activeTab === "steps" && <StepsTab device={device} />}

          {activeTab === "timeline" && <TimelineTab device={device} />}
        </div>
      </div>
    </SidePanel>
  );
}
