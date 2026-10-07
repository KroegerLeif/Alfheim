"use client";

import React from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { CATEGORY_ICONS } from "@/shared/data";
import { Device } from "@/shared/types";
import { cn } from "@/core/utils";
import { useDeviceLabels } from "../hooks/useDeviceLabels";

interface DeviceCardProps {
  device: Device;
  onSelect: (device: Device) => void;
}

const STATUS_BADGE_CLASS: Record<Device["status"], string> = {
  active: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  maintenance: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  inactive: "text-[var(--text-muted)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]",
};

const FALLBACK_BADGE_CLASS = STATUS_BADGE_CLASS.inactive;

/** Inventory card of one device. Rendered as a button so it is reachable and operable by keyboard. */
export function DeviceCard({ device, onSelect }: DeviceCardProps) {
  const t = useTranslations("maintenance");
  const { statusLabel } = useDeviceLabels();
  const IconComponent = CATEGORY_ICONS[device.category as keyof typeof CATEGORY_ICONS] || Info;

  return (
    <button
      type="button"
      onClick={() => onSelect(device)}
      className="group w-full min-w-0 text-left bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl p-5 border hover:border-[var(--primary-main)]/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden shadow-sm"
    >
      {/* Glow effect on hover */}
      <span className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-main)]/5 rounded-full blur-2xl group-hover:bg-[var(--primary-main)]/10 transition-colors" />

      <span className="block space-y-3 relative z-10 min-w-0">
        {/* Top Row: Category icon & Status */}
        <span className="flex items-center justify-between gap-2">
          <span className="h-9 w-9 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)] group-hover:scale-105 transition-all shrink-0">
            <IconComponent className="h-4.5 w-4.5" />
          </span>
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border truncate",
              STATUS_BADGE_CLASS[device.status] ?? FALLBACK_BADGE_CLASS
            )}
          >
            {statusLabel(device.status)}
          </span>
        </span>

        {/* Device Info */}
        <span className="block min-w-0">
          <span
            className="block text-base font-black uppercase text-[var(--text-main)] tracking-wide group-hover:text-[var(--primary-main)] transition-colors truncate"
            title={device.name}
          >
            {device.name}
          </span>
          <span className="block text-xs text-[var(--text-muted)] mt-0.5 font-semibold uppercase tracking-wider truncate" title={device.location}>
            {device.location}
          </span>
        </span>
      </span>

      {/* Bottom Attributes Block */}
      <span className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 text-[10px] font-mono text-[var(--text-muted)] relative z-10">
        <span className="min-w-0 truncate" title={device.model}>
          {t("deviceInventory.fields.model")}: {device.model}
        </span>
        <span className="shrink-0">
          {t("deviceInventory.fields.steps")}: {device.steps?.length ?? 0}
        </span>
      </span>
    </button>
  );
}
