"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";

export function ManualsPanel() {
  const t = useTranslations("maintenance");

  return (
    <div className="hidden lg:flex lg:col-span-3 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex-col space-y-4 overflow-y-auto">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
        <FileText className="h-4 w-4 text-[var(--text-muted)]" />
        <span>{t("wizardMode.directManuals")}</span>
      </div>

      {/* Manuals Empty State */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] text-center py-6">
          {t("deviceInventory.fields.noManuals")}
        </p>
      </div>
    </div>
  );
}
