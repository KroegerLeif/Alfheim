"use client";

import React, { useState } from "react";
import { Device } from "@/shared/types";
import { DeviceDetailPanel } from "./DeviceDetailPanel";
import { AddDeviceWizard } from "./AddDeviceWizard";
import { DeviceCard } from "./DeviceCard";
import { Info, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHouseholds, useDevices } from "../hooks/useDevices";
import { groupDevicesByHousehold } from "../utils";

interface DevicesViewProps {
  onStartMaintenance?: (device: Device) => void;
}

export function DevicesView({ onStartMaintenance }: DevicesViewProps) {
  const t = useTranslations("maintenance");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Fetch households and devices using custom FDD hooks
  const { data: households, isError: householdsError } = useHouseholds();
  const { data: devices, isLoading, isError: devicesError } = useDevices();

  const isError = householdsError || devicesError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const groupedDevices = groupDevicesByHousehold(
    devices ?? [],
    households ?? [],
    t("deviceInventory.otherLocations")
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {isError && (
        <div role="alert" className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          {t("deviceInventory.loadError")}
        </div>
      )}

      {/* Page header with Add Device FAB */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
          {t("deviceInventory.tagline")}
        </span>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider rounded-xl border border-transparent transition-all shadow-md shadow-[var(--primary-main)]/10 cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("deviceInventory.addDevice")}
        </button>
      </div>

      {groupedDevices.length === 0 ? (
        !isError && (
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <Info className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
            <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
              {t("deviceInventory.noDevicesFound")}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{t("deviceInventory.noDevicesDesc")}</p>
          </div>
        )
      ) : (
        groupedDevices.map((group) => (
          <div key={group.id} className="space-y-4">
            {/* Household Header */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
                {t("deviceInventory.locationGroup")}
              </span>
              <h2 className="min-w-0 break-words text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                {group.name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                {t("deviceInventory.deviceCount", { count: group.devices.length })}
              </span>
            </div>

            {/* Devices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.devices.map((device) => (
                <DeviceCard key={device.id} device={device} onSelect={setSelectedDevice} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Slide-over Detail Panel */}
      {selectedDevice && (
        <DeviceDetailPanel
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onStartMaintenance={onStartMaintenance}
        />
      )}

      {/* Register Device Wizard Overlay */}
      {showWizard && <AddDeviceWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
