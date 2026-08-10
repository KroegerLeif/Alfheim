"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { Device } from "@/shared/types";
import { daysUntil } from "@/core/utils";
import { DeviceDetailPanel, useDevices } from "@/features/devices";
import { Loader2 } from "lucide-react";
import { MaintenanceMetrics } from "./MaintenanceMetrics";
import { DeviceMaintenanceList } from "./DeviceMaintenanceList";

interface MaintenanceViewProps {
  onStartMaintenance: (device: Device) => void;
}

type MetricFilter = "all" | "overdue" | "due_soon" | "ok";

export function MaintenanceView({ onStartMaintenance }: MaintenanceViewProps) {
  const { householdId } = useLayout();
  const [filter, setFilter] = useState<MetricFilter>("all");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Fetch devices using FDD query hook
  const { data: devices = [], isLoading } = useDevices(householdId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const deviceList = devices ?? [];

  // Calculate metrics across the filtered devices
  let totalStepsCount = 0;
  let overdueStepsCount = 0;
  let dueSoonStepsCount = 0;
  let okStepsCount = 0;

  deviceList.forEach((device) => {
    const steps = device.steps ?? [];
    steps.forEach((step) => {
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
  });

  // Helper to categorize a device's maintenance state
  const getDeviceMaintenanceState = (device: Device): MetricFilter => {
    const steps = device.steps ?? [];
    if (steps.length === 0) return "ok";
    
    let hasOverdue = false;
    let hasDueSoon = false;

    steps.forEach((step) => {
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
  const filteredDevices = deviceList.filter((device) => {
    if (filter === "all") return true;
    return getDeviceMaintenanceState(device) === filter;
  });

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto font-sans">
      <MaintenanceMetrics
        filter={filter}
        setFilter={setFilter}
        totalStepsCount={totalStepsCount}
        overdueStepsCount={overdueStepsCount}
        dueSoonStepsCount={dueSoonStepsCount}
        okStepsCount={okStepsCount}
      />

      <DeviceMaintenanceList
        filteredDevices={filteredDevices}
        filter={filter}
        getDeviceMaintenanceState={getDeviceMaintenanceState}
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
