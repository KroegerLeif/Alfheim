"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { DeviceDetailPanel, useDevices } from "@/features/devices";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { MaintenanceMetrics } from "./MaintenanceMetrics";
import { DeviceMaintenanceList } from "./DeviceMaintenanceList";
import { countSteps, getDeviceMaintenanceState, MetricFilter } from "../utils";

interface MaintenanceViewProps {
  onStartMaintenance: (device: Device) => void;
}

export function MaintenanceView({ onStartMaintenance }: MaintenanceViewProps) {
  const t = useTranslations("maintenance");
  const [filter, setFilter] = useState<MetricFilter>("all");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Fetch devices using FDD query hook
  const { data: devices, isLoading, isError } = useDevices();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const deviceList = devices ?? [];
  const counts = countSteps(deviceList);

  // Filter devices based on metric card click
  const filteredDevices = deviceList.filter(
    (device) => filter === "all" || getDeviceMaintenanceState(device) === filter
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto font-sans">
      {isError && (
        <div role="alert" className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          {t("deviceInventory.loadError")}
        </div>
      )}

      <MaintenanceMetrics
        filter={filter}
        setFilter={setFilter}
        totalStepsCount={counts.total}
        overdueStepsCount={counts.overdue}
        dueSoonStepsCount={counts.dueSoon}
        okStepsCount={counts.ok}
      />

      <DeviceMaintenanceList
        filteredDevices={filteredDevices}
        filter={filter}
        setSelectedDevice={setSelectedDevice}
        onStartMaintenance={onStartMaintenance}
      />

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
