"use client";

import React, { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import {
  ActiveLoansList,
  LendingHistoryTable,
  useLending,
} from "@/features/lending";
import { LendingRecord } from "@/features/lending/types";

export default function LendingPage() {
  const { t } = useTranslation();
  const { activeLoans, history, isLoading, returnItem } = useLending();
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  const handleReturnItem = async (record: LendingRecord) => {
    try {
      await returnItem(record.item_id);
    } catch {
      // Error handled inside hook
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main,#f8fafc)]">
            {t("library.lending.title")}
          </h1>
          <p className="text-sm text-[var(--text-muted,#94a3b8)]">
            {t("library.lending.subtitle")}
          </p>
        </div>

        <div className="flex rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] p-1">
          <button
            onClick={() => setActiveTab("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "active"
                ? "bg-primary text-white"
                : "text-[var(--text-muted,#94a3b8)] hover:text-[var(--text-main,#f8fafc)]"
            }`}
          >
            {t("library.lending.activeLoans")} ({activeLoans.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-white"
                : "text-[var(--text-muted,#94a3b8)] hover:text-[var(--text-main,#f8fafc)]"
            }`}
          >
            {t("library.lending.history")} ({history.length})
          </button>
        </div>
      </div>

      {activeTab === "active" ? (
        <ActiveLoansList
          loans={activeLoans}
          isLoading={isLoading}
          onReturnItem={handleReturnItem}
        />
      ) : (
        <LendingHistoryTable history={history} isLoading={isLoading} />
      )}
    </div>
  );
}
