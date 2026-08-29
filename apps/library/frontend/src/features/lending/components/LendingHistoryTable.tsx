import React from "react";
import { Badge, Table, useTranslation } from "@alfheim/shared";
import { LendingRecord } from "../types";

interface LendingHistoryTableProps {
  history: LendingRecord[];
  isLoading?: boolean;
}

export function LendingHistoryTable({
  history,
  isLoading,
}: LendingHistoryTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-card,#1e293b)] p-4 text-xs text-[var(--text-muted,#64748b)] animate-pulse">
        {t("library.lending.history")}...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-main,#334155)] p-8 text-center text-xs text-[var(--text-muted,#64748b)]">
        {t("library.lending.noActiveLoans")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)]">
      <Table>
        <thead>
          <tr className="border-b border-[var(--border-main,#334155)] text-left text-xs text-[var(--text-muted,#94a3b8)]">
            <th className="p-3 font-semibold">{t("library.itemDialog.title")}</th>
            <th className="p-3 font-semibold">{t("library.lending.borrower")}</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">{t("library.lending.lentAt")}</th>
            <th className="p-3 font-semibold">{t("library.lending.dueDate")}</th>
            <th className="p-3 font-semibold">{t("library.lending.notes")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle,#334155)] text-xs text-[var(--text-main,#f8fafc)]">
          {history.map((record) => (
            <tr key={record.id} className="hover:bg-[var(--surface-muted,#0f172a)]/50">
              <td className="p-3 font-medium">
                {record.item?.title || record.item_id}
              </td>
              <td className="p-3 text-[var(--text-muted,#94a3b8)]">
                {record.contact_name}
              </td>
              <td className="p-3">
                {record.status === "LENT_OUT" ? (
                  <Badge variant="secondary">{t("library.lending.statusLent")}</Badge>
                ) : (
                  <Badge variant="outline">{t("library.lending.statusAvailable")}</Badge>
                )}
              </td>
              <td className="p-3 text-[var(--text-muted,#94a3b8)]">
                {new Date(record.lent_at).toLocaleDateString()}
              </td>
              <td className="p-3 text-[var(--text-muted,#94a3b8)]">
                {record.due_date ? new Date(record.due_date).toLocaleDateString() : "-"}
              </td>
              <td className="p-3 text-[var(--text-muted,#64748b)] max-w-xs truncate">
                {record.notes || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
