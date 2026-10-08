"use client";

import React, { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import {
  ActiveLoansList,
  LENDING_HISTORY_LIMIT,
  LendingHistoryTable,
  useLending,
} from "@/features/lending";
import { LendingRecord } from "@/features/lending/types";

export default function LendingPage() {
  const { t } = useTranslation();
  const { activeLoans, history, total, isLoading, error, returnItem } = useLending();
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const isLoadError = error === "load";

  const handleReturnItem = async (record: LendingRecord) => {
    try {
      await returnItem(record.item_id);
    } catch {
      // The hook records the failure in `error`, which is rendered as a banner below.
    }
  };

  const tabClass = (tab: "active" | "history") =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      activeTab === tab
        ? "bg-primary text-white"
        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
    }`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {t("library.lending.title")}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t("library.lending.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1">
          <button type="button" onClick={() => setActiveTab("active")} className={tabClass("active")}>
            {t("library.lending.activeLoans")} ({activeLoans.length})
          </button>
          <button type="button" onClick={() => setActiveTab("history")} className={tabClass("history")}>
            {t("library.lending.history")} ({history.length})
          </button>
        </div>
      </div>

      {(error === "return" || error === "lend") && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"
        >
          {error === "return"
            ? t("library.lending.returnError")
            : t("library.lending.lendError")}
        </div>
      )}

      {activeTab === "active" ? (
        <ActiveLoansList
          loans={activeLoans}
          isLoading={isLoading}
          isError={isLoadError}
          onReturnItem={handleReturnItem}
        />
      ) : (
        <>
          <LendingHistoryTable history={history} isLoading={isLoading} isError={isLoadError} />
          {total > history.length && (
            <p className="text-center text-xs text-[var(--text-muted)]">
              {t("library.lending.historyTruncated", {
                shown: Math.min(history.length, LENDING_HISTORY_LIMIT),
                total,
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
