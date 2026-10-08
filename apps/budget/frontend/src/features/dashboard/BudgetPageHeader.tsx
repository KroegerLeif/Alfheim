"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { RefreshCw } from "lucide-react";

export interface BudgetPageHeaderProps {
  loading: boolean;
  onReload: () => void;
}

/** Page title with subtitle and the refresh button. */
export function BudgetPageHeader({ loading, onReload }: BudgetPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[var(--text-main)] truncate">{t("budget.title")}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{t("budget.pageSubtitle")}</p>
      </div>
      <button
        type="button"
        onClick={onReload}
        aria-label={t("budget.refreshData")}
        className="p-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
