"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Device } from "@/shared/types";
import { Info, Wrench } from "lucide-react";

interface OverviewTabProps {
  device: Device;
  onStartMaintenance?: (device: Device) => void;
  onClose: () => void;
}

export function OverviewTab({ device, onStartMaintenance, onClose }: OverviewTabProps) {
  const t = useTranslations("maintenance");

  return (
    <div className="space-y-6">
      {/* Meta Attributes Card */}
      <div className="bg-[var(--surface-canvas)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {t("deviceInventory.fields.location")}
            </span>
            <span className="block text-xs font-bold text-[var(--text-main)] uppercase">{device.location}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {t("deviceInventory.fields.model")}
            </span>
            <span className="block text-xs font-mono font-bold text-[var(--text-main)]">{device.model}</span>
          </div>
          <div className="space-y-1 col-span-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {t("deviceInventory.fields.serialKey")}
            </span>
            <span className="block text-xs font-mono font-bold text-[var(--primary-main)]">{device.serial}</span>
          </div>
        </div>
      </div>

      {/* Notes if present */}
      {device.notes && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {t("deviceInventory.fields.serviceNotes")}
          </h4>
          <p className="text-xs text-[var(--text-main)] leading-relaxed font-semibold italic bg-[var(--surface-canvas)] p-4 rounded-xl border border-[var(--border-subtle)]">
            &quot;{device.notes}&quot;
          </p>
        </div>
      )}

      {/* Status Info Block */}
      <div className="p-5 rounded-xl border bg-[var(--primary-main)]/5 border-[var(--primary-main)]/10 flex gap-4">
        <Info className="h-5 w-5 text-[var(--primary-main)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
            {t("deviceInventory.fields.statusMonitor")}
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">
            {t("deviceInventory.fields.statusFlagged", { status: device.status })}
          </p>
        </div>
      </div>

      {onStartMaintenance && (
        <button
          onClick={() => {
            onStartMaintenance(device);
            onClose();
          }}
          className="w-full py-3.5 rounded-xl bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[var(--primary-main)]/10"
        >
          <Wrench className="h-4 w-4" />
          {t("deviceInventory.fields.startMaintenance")}
        </button>
      )}
    </div>
  );
}
