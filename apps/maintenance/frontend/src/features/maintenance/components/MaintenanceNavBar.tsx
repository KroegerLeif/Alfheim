"use client";

import React from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface MaintenanceNavBarProps {
  deviceName: string;
  progressPercentage: number;
  onClose: () => void;
  isPending: boolean;
}

export function MaintenanceNavBar({
  deviceName,
  progressPercentage,
  onClose,
  isPending,
}: MaintenanceNavBarProps) {
  const t = useTranslations("maintenance");

  return (
    <>
      <div className="h-16 border-b border-[var(--border-subtle)] px-6 flex items-center justify-between bg-[var(--surface-card)]">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--primary-main)] leading-none">
              {t("wizardMode.tagline")}
            </span>
            <span className="text-base font-black uppercase text-[var(--text-main)] truncate max-w-sm">
              {deviceName}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 w-96">
          <div className="w-full bg-[var(--surface-canvas)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
            <div
              className="bg-[var(--primary-main)] h-full transition-all duration-300 shadow-md"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-[var(--primary-main)] shrink-0">
            {t("wizardMode.progress", { percentage: progressPercentage })}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
          aria-label={t("wizardMode.exitLabel")}
          disabled={isPending}
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="md:hidden w-full bg-[var(--surface-canvas)] h-1 relative overflow-hidden">
        <div
          className="bg-[var(--primary-main)] h-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </>
  );
}
