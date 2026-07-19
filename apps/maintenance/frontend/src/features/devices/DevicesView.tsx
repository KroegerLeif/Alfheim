"use client";

import React, { useState } from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { initialDevices, households, CATEGORY_ICONS } from "@/shared/data";
import { Device } from "@/shared/types";
import { DeviceDetailPanel } from "./DeviceDetailPanel";
import { Info, MapPin } from "lucide-react";
import { cn } from "@/shared/utils";

export function DevicesView() {
  const { householdId } = useLayout();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Filter devices based on household selection
  const filteredDevices = initialDevices.filter(
    (d) => householdId === null || d.householdId === householdId
  );

  // Group devices by household
  const groupedDevices = households.reduce((acc, h) => {
    const devicesInHousehold = filteredDevices.filter((d) => d.householdId === h.id);
    if (devicesInHousehold.length > 0) {
      acc.push({ household: h, devices: devicesInHousehold });
    }
    return acc;
  }, [] as { household: typeof households[number]; devices: Device[] }[]);

  // If "All Households" is selected and there are devices not matching any defined household
  const orphans = filteredDevices.filter(
    (d) => !households.some((h) => h.id === d.householdId)
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
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "maintenance":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "inactive":
        return "text-slate-400 bg-slate-500/10 border-white/5";
      default:
        return "text-slate-400 bg-slate-500/10 border-white/5";
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {groupedDevices.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/10 p-12 text-center max-w-md mx-auto space-y-4">
          <Info className="h-10 w-10 text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">No Devices Found</h3>
          <p className="text-sm text-slate-400">
            There are no devices registered under the selected household.
          </p>
        </div>
      ) : (
        groupedDevices.map(({ household, devices }) => (
          <div key={household.id} className="space-y-4">
            {/* Household Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                Location Group //
              </span>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">
                {household.name}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
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
                    className="group glass-card rounded-2xl p-5 border border-white/10 hover:border-cyan-500/30 hover:shadow-cyan-950/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />

                    <div className="space-y-3 relative z-10">
                      {/* Top Row: Category icon & Status */}
                      <div className="flex items-center justify-between">
                        <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-cyan-400 group-hover:text-cyan-300 transition-colors">
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border", getStatusBadgeClass(device.status))}>
                          {device.status}
                        </span>
                      </div>

                      {/* Device Meta */}
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                          {device.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium font-mono truncate">
                          Model: {device.model}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Location & Serial */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wide relative z-10">
                      <div className="flex items-center gap-1 text-slate-400 truncate max-w-[60%]">
                        <MapPin className="h-3.5 w-3.5 text-cyan-500/50 shrink-0" />
                        <span className="truncate">{device.location}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-[40%]">
                        {device.serialNumber}
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
        />
      )}
    </div>
  );
}
