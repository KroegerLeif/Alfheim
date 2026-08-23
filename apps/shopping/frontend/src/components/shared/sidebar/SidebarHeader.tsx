"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppLogo } from "@alfheim/shared";
import { ChevronLeft } from "lucide-react";

interface SidebarHeaderProps {
  onClose: () => void;
}

export function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const t = useTranslations("Navigation");

  return (
    <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-3">
        <AppLogo appName="shopping" size={32} />
        <div className="flex flex-col">
          <span className="font-heading text-sm font-bold uppercase tracking-wider text-[var(--text-main)] leading-tight">
            ALFHEIM // SHOPPING
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-none">
            {t("subtitle") || "Smart Grocery List"}
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] cursor-pointer transition-colors"
        aria-label={t("collapseSidebar")}
        title={t("collapseSidebar")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
