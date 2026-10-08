import React from "react";
import { Badge, Table, useTranslation } from "@alfheim/shared";
import { formatDate } from "@/core/formatDate";
import { LendingRecord } from "../types";
import { LendingLoadError } from "./LendingLoadError";

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
  const { t, language } = useTranslation();

  if (isError) {
    return <LendingLoadError />;
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
        {t("library.lending.noHistory")}
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
            <th className="p-3 font-semibold">{t("library.lending.statusColumn")}</th>
            <th className="p-3 font-semibold">{t("library.lending.lentAt")}</th>
            <th className="p-3 font-semibold">{t("library.lending.dueDate")}</th>
            <th className="p-3 font-semibold">{t("library.lending.notes")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] text-xs text-[var(--text-main)]">
          {history.map((record) => (
            <tr key={record.id} className="hover:bg-[var(--surface-elevated)]/50">
              <td className="max-w-[16rem] break-words p-3 font-medium">
                {record.item_title || t("library.lending.unknownItem")}
              </td>
              <td className="max-w-[12rem] break-words p-3 text-[var(--text-muted)]">
                {record.contact_name}
              </td>
              <td className="p-3">
                {record.status === "LENT_OUT" ? (
                  <Badge variant="secondary">{t("library.lending.statusLent")}</Badge>
                ) : (
                  <Badge variant="outline">{t("library.lending.statusAvailable")}</Badge>
                )}
              </td>
              <td className="whitespace-nowrap p-3 text-[var(--text-muted)]">
                {formatDate(record.lent_at, language)}
              </td>
              <td className="whitespace-nowrap p-3 text-[var(--text-muted)]">
                {record.due_date ? formatDate(record.due_date, language) : "-"}
              </td>
              <td
                className="p-3 text-[var(--text-muted)] max-w-xs truncate"
                title={record.notes ?? undefined}
              >
                {record.notes || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
