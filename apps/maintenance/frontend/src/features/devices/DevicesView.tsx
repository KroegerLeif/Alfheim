"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getDevices, getHouseholds } from "@/shared/api";
import { CATEGORY_ICONS } from "@/shared/data";
import { Device } from "@/shared/types";
import { DeviceDetailPanel } from "./DeviceDetailPanel";
import { AddDeviceWizard } from "./AddDeviceWizard";
import { Info, MapPin, Loader2, Plus } from "lucide-react";
import { cn } from "@/shared/utils";

interface DevicesViewProps {
  onStartMaintenance?: (device: Device) => void;
}

export function DevicesView({ onStartMaintenance }: DevicesViewProps) {
  const { householdId } = useLayout();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Fetch households and devices
  const { data: households = [] } = useQuery({
    queryKey: ["households"],
    queryFn: getHouseholds,
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", householdId],
    queryFn: () => getDevices(householdId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-cyan-600 dark:text-cyan-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Group devices by household
  const groupedDevices = households.reduce<{ household: any; devices: Device[] }[]>((acc, h) => {
    const devicesInHousehold = devices.filter((d) => d.household_id === h.id);
    if (devicesInHousehold.length > 0) {
      acc.push({ household: h, devices: devicesInHousehold });
    }
    return acc;
  }, []);

  const orphans = devices.filter(
    (d) => !households.some((h) => h.id === d.household_id)
  );
  if (orphans.length > 0) {
    groupedDevices.push({
      household: { id: -1, name: "Other Locations" },
      devices: orphans,
    });
  }

  const getStatusBadgeClass = (status: Device["status"]) => {
    switch (status) {
      case "active":
        return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
      case "maintenance":
        return "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
      case "inactive":
        return "text-slate-500 bg-slate-500/10 border-slate-200 dark:border-white/5";
      default:
        return "text-slate-500 bg-slate-500/10 border-slate-200 dark:border-white/5";
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Page header with Add Device FAB */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Device Inventory //</span>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl border border-transparent transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Device
        </button>
      </div>
      {groupedDevices.length === 0 ? (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <Info className="h-10 w-10 text-cyan-600 dark:text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">No Devices Found</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            There are no devices registered under the selected household.
          </p>
        </div>
      ) : (
        groupedDevices.map(({ household, devices }) => (
          <div key={household.id} className="space-y-4">
            {/* Household Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                Location Group //
              </span>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-300">
                {household.name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-white/5 dark:text-slate-400">
                {devices.length} {devices.length === 1 ? "device" : "devices"}
              </span>
            </div>

            {/* Devices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => {
                const IconComponent = CATEGORY_ICONS[device.category as keyof typeof CATEGORY_ICONS] || Info;

                return (
                  <div
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className="group bg-white border-slate-200 text-slate-900 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-5 border hover:border-cyan-500/40 dark:hover:border-cyan-500/30 hover:shadow-cyan-500/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden shadow-sm"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />

                    <div className="space-y-3 relative z-10">
                      {/* Top Row: Category icon & Status */}
                      <div className="flex items-center justify-between">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors">
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border", getStatusBadgeClass(device.status))}>
                          {device.status}
                        </span>
                      </div>

                      {/* Device Meta */}
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                          {device.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono truncate">
                          Model: {device.model}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Location & Serial */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wide relative z-10">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate max-w-[60%]">
                        <MapPin className="h-3.5 w-3.5 text-cyan-500/70 shrink-0" />
                        <span className="truncate">{device.location}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[40%]">
                        {device.serial}
                      </span>
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

      {/* Add Device Wizard Overlay */}
      {showWizard && (
        <AddDeviceWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
