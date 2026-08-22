"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { CATEGORY_ICONS } from "@/shared/data";
import { Device } from "@/shared/types";
import { DeviceDetailPanel } from "./DeviceDetailPanel";
import { AddDeviceWizard } from "./AddDeviceWizard";
import { Info, Loader2, Plus } from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";
import { useHouseholds, useDevices } from "../hooks/useDevices";

interface DevicesViewProps {
  onStartMaintenance?: (device: Device) => void;
}

export function DevicesView({ onStartMaintenance }: DevicesViewProps) {
  const t = useTranslations("maintenance");
  const { householdId } = useLayout();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Fetch households and devices using custom FDD hooks
  const { data: households = [], isError: householdsError } = useHouseholds();
  const { data: devices = [], isLoading, isError: devicesError } = useDevices(householdId);

  const isError = householdsError || devicesError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--primary-main)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Group devices by household
  const householdList = households ?? [];
  const deviceList = devices ?? [];

  const groupedDevices = householdList.reduce<{ household: any; devices: Device[] }[]>((acc, h) => {
    const devicesInHousehold = deviceList.filter((d) => d.household_id === h.id);
    if (devicesInHousehold.length > 0) {
      acc.push({ household: h, devices: devicesInHousehold });
    }
    return acc;
  }, []);

  const orphans = deviceList.filter(
    (d) => !householdList.some((h) => h.id === d.household_id)
  );
  if (orphans.length > 0) {
    groupedDevices.push({
      household: { id: -1, name: t("deviceInventory.otherLocations") },
      devices: orphans,
    });
  }

  const getStatusBadgeClass = (status: Device["status"]) => {
    switch (status) {
      case "active":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "maintenance":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "inactive":
        return "text-[var(--text-muted)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]";
      default:
        return "text-[var(--text-muted)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]";
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {isError && (
        <div className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          Failed to load devices or location data. Please refresh or try again later.
        </div>
      )}

      {/* Page header with Add Device FAB */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
            {t("deviceInventory.tagline")}
          </span>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider rounded-xl border border-transparent transition-all shadow-md shadow-[var(--primary-main)]/10 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("deviceInventory.addDevice")}
        </button>
      </div>
      {groupedDevices.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <Info className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
            {t("deviceInventory.noDevicesFound")}
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            {t("deviceInventory.noDevicesDesc")}
          </p>
        </div>
      ) : (
        groupedDevices.map(({ household, devices }) => (
          <div key={household.id} className="space-y-4">
            {/* Household Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
                {t("deviceInventory.locationGroup")}
              </span>
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                {household.name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                {t("deviceInventory.deviceCount", { count: devices.length })}
              </span>
            </div>

            {/* Devices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(devices ?? []).map((device) => {
                const IconComponent = CATEGORY_ICONS[device.category as keyof typeof CATEGORY_ICONS] || Info;

                return (
                  <div
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className="group bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl p-5 border hover:border-[var(--primary-main)]/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden shadow-sm"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-main)]/5 rounded-full blur-2xl group-hover:bg-[var(--primary-main)]/10 transition-colors" />

                    <div className="space-y-3 relative z-10">
                      {/* Top Row: Category icon & Status */}
                      <div className="flex items-center justify-between">
                        <div className="h-9 w-9 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)] group-hover:scale-105 transition-all">
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border", getStatusBadgeClass(device.status))}>
                          {device.status}
                        </span>
                      </div>

                      {/* Device Info */}
                      <div>
                        <h3 className="text-base font-black uppercase text-[var(--text-main)] tracking-wide group-hover:text-[var(--primary-main)] transition-colors truncate">
                          {device.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-semibold uppercase tracking-wider">
                          {device.location}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Attributes Block */}
                    <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] relative z-10">
                      <span>{t("deviceInventory.fields.model")}: {device.model}</span>
                      <span>{t("deviceInventory.fields.steps")}: {device.steps?.length ?? 0}</span>
                    </div>
                  </div>
                );
              })}
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
      {showWizard && (
        <AddDeviceWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
