"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useLayout } from "@/shared/layout/LayoutContext";
import { DevicesView } from "@/features/devices/DevicesView";
import { MaintenanceView } from "@/features/maintenance/MaintenanceView";
import { MaintenanceMode } from "@/features/maintenance/MaintenanceMode";
import { Device } from "@/shared/types";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  const t = useTranslations("Navigation");
  const { activeNav } = useLayout();
  
  // Track which device is currently in active step-by-step wizard mode
  const [maintenanceDevice, setMaintenanceDevice] = useState<Device | null>(null);

  return (
    <>
      {activeNav === "devices" && (
        <DevicesView onStartMaintenance={(device) => setMaintenanceDevice(device)} />
      )}
      
      {activeNav === "maintenance" && (
        <MaintenanceView onStartMaintenance={(device) => setMaintenanceDevice(device)} />
      )}

      {/* Fallback for under construction modules */}
      {activeNav !== "devices" && activeNav !== "maintenance" && (
        <main className="flex flex-col items-center justify-center p-12 text-white text-center h-full min-h-[calc(100vh-4rem)]">
          <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-white/10 shadow-2xl space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <Wrench className="h-8 w-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                {activeNav}
              </h2>
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
                Module Under Construction
              </p>
            </div>
            <p className="text-sm text-slate-400 font-medium">
              The layout and scaffolding are complete. Feature implementation is in progress.
            </p>
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
