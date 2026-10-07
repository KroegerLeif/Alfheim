"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { DevicesView } from "@/features/devices";
import { MaintenanceView, MaintenanceMode } from "@/features/maintenance";
import { ScheduledView } from "@/features/scheduled";
import { HistoryView } from "@/features/history";
import { ShoppingView } from "@/features/shopping";
import { Device } from "@/shared/types";

export default function MaintenancePage() {
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

      {activeNav === "scheduled" && <ScheduledView />}

      {activeNav === "history" && <HistoryView />}

      {activeNav === "shopping" && <ShoppingView />}

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
