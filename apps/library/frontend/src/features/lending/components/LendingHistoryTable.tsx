import React from "react";
import { Badge, Table, useTranslation } from "@alfheim/shared";
import { LendingRecord } from "../types";

interface LendingHistoryTableProps {
  history: LendingRecord[];
  isLoading?: boolean;
  isError?: boolean;
}

export function LendingHistoryTable({
  history,
  isLoading,
  isError,
}: LendingHistoryTableProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-red-500/20 bg-red-500/5 p-8 text-center text-xs text-[var(--text-muted)]">
        <div className="inline-flex h-8 w-8 rounded-full bg-red-500/10 items-center justify-center text-red-400 mb-2">
          ⚠️
        </div>
        <div className="font-semibold text-[var(--text-main)]">
          Failed to load lending history
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {t("library.lending.errorLoading") || "An error occurred while loading the lending history. Please try again."}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-xs text-[var(--text-muted)] animate-pulse">
        {t("library.lending.history")}...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-muted)]">
        {t("library.lending.noActiveLoans")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <Table>
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
            <th className="p-3 font-semibold">{t("library.itemDialog.title")}</th>
            <th className="p-3 font-semibold">{t("library.lending.borrower")}</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">{t("library.lending.lentAt")}</th>
            <th className="p-3 font-semibold">{t("library.lending.dueDate")}</th>
            <th className="p-3 font-semibold">{t("library.lending.notes")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] text-xs text-[var(--text-main)]">
          {history.map((record) => (
            <tr key={record.id} className="hover:bg-[var(--surface-elevated)]/50">
              <td className="p-3 font-medium">
                {record.item?.title || record.item_id}
              </td>
              <td className="p-3 text-[var(--text-muted)]">
                {record.contact_name}
              </td>
              <td className="p-3">
                {record.status === "LENT_OUT" ? (
                  <Badge variant="secondary">{t("library.lending.statusLent")}</Badge>
                ) : (
                  <Badge variant="outline">{t("library.lending.statusAvailable")}</Badge>
                )}
              </td>
              <td className="p-3 text-[var(--text-muted)]">
                {new Date(record.lent_at).toLocaleDateString()}
              </td>
              <td className="p-3 text-[var(--text-muted)]">
                {record.due_date ? new Date(record.due_date).toLocaleDateString() : "-"}
              </td>
              <td className="p-3 text-[var(--text-muted)] max-w-xs truncate">
                {record.notes || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
