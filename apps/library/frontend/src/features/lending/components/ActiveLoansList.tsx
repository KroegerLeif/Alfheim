import React from "react";
import { Badge, Button, useTranslation } from "@alfheim/shared";
import { LendingRecord } from "../types";

interface ActiveLoansListProps {
  loans: LendingRecord[];
  isLoading?: boolean;
  onReturnItem: (record: LendingRecord) => void;
}

export function ActiveLoansList({
  loans,
  isLoading,
  onReturnItem,
}: ActiveLoansListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-36 rounded-2xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-card,#1e293b)] animate-pulse p-4"
          />
        ))}
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-main,#334155)] p-8 text-center text-xs text-[var(--text-muted,#64748b)]">
        {t("library.lending.noActiveLoans")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {loans.map((record) => {
        const isOverdue =
          record.due_date && new Date(record.due_date) < new Date();

        return (
          <div
            key={record.id}
            className="flex flex-col justify-between rounded-2xl border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] p-4 space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-sm text-[var(--text-main,#f8fafc)] line-clamp-1">
                  {record.item?.title || record.item_id}
                </h4>
                {isOverdue ? (
                  <Badge variant="destructive">
                    {t("library.lending.statusOverdue")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {t("library.lending.statusLent")}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-[var(--text-muted,#94a3b8)]">
                <span className="font-medium text-[var(--text-main,#f8fafc)]">
                  👤 {record.contact_name}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted,#64748b)] pt-1">
                <span>
                  📅 {t("library.lending.lentAt")}:{" "}
                  {new Date(record.lent_at).toLocaleDateString()}
                </span>
                {record.due_date && (
                  <span>
                    ⏰ {t("library.lending.dueDate")}:{" "}
                    {new Date(record.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              {record.notes && (
                <p className="text-[11px] text-[var(--text-muted,#64748b)] italic line-clamp-2 pt-1 border-t border-[var(--border-subtle,#334155)]">
                  &quot;{record.notes}&quot;
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onReturnItem(record)}
              >
                {t("library.lending.markReturned")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
