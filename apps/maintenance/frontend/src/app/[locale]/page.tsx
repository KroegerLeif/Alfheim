"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useLayout } from "@/shared/layout/LayoutContext";
import { DevicesView } from "@/features/devices";
import { MaintenanceView, MaintenanceMode } from "@/features/maintenance";
import { ScheduledView } from "@/features/scheduled";
import { HistoryView } from "@/features/history";
import { ShoppingView } from "@/features/shopping";
import { Device } from "@/shared/types";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  const t = useTranslations("common");
  const { activeNav } = useLayout();
  
  // Track which device is currently in active step-by-step wizard mode
  const [maintenanceDevice, setMaintenanceDevice] = useState<Device | null>(null);

  const isMainView = 
    activeNav === "devices" || 
    activeNav === "maintenance" || 
    activeNav === "scheduled" || 
    activeNav === "history" || 
    activeNav === "shopping";

  return (
    <>
      {activeNav === "devices" && (
        <DevicesView onStartMaintenance={(device) => setMaintenanceDevice(device)} />
      )}
      
      {activeNav === "maintenance" && (
        <MaintenanceView onStartMaintenance={(device) => setMaintenanceDevice(device)} />
      )}

      {activeNav === "scheduled" && (
        <ScheduledView />
      )}

      {activeNav === "history" && (
        <HistoryView />
      )}

      {activeNav === "shopping" && (
        <ShoppingView />
      )}

      {/* Fallback for under construction modules if any unrecognized nav option is active */}
      {!isMainView && (
        <main className="flex flex-col items-center justify-center p-12 text-[var(--text-main)] text-center h-full min-h-[calc(100vh-4rem)]">
          <div className="bg-[var(--surface-card)] max-w-md w-full p-8 rounded-2xl border border-[var(--border-subtle)] shadow-2xl space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)]">
              <Wrench className="h-8 w-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)] uppercase">
                {activeNav}
              </h2>
              <p className="text-xs font-semibold text-[var(--primary-main)] uppercase tracking-widest">
                {t("in_progress")}
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Step-by-Step Maintenance Mode Overlay Wizard */}
      {maintenanceDevice && (
        <MaintenanceMode
          device={maintenanceDevice}
          onClose={() => setMaintenanceDevice(null)}
        />
      )}
    </>
  );
}
