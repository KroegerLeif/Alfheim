import React from "react";
import { Calendar, Clock, User } from "lucide-react";
import { Badge, Button, useTranslation } from "@alfheim/shared";
import { formatDate } from "@/core/formatDate";
import { LendingRecord } from "../types";
import { LendingLoadError } from "./LendingLoadError";

interface ActiveLoansListProps {
  loans: LendingRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onReturnItem: (record: LendingRecord) => void;
}

export function ActiveLoansList({
  loans,
  isLoading,
  isError,
  onReturnItem,
}: ActiveLoansListProps) {
  const { t, language } = useTranslation();

  if (isError) {
    return <LendingLoadError />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-36 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] animate-pulse p-4"
          />
        ))}
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-muted)]">
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
            className="flex min-w-0 flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="min-w-0 break-words font-bold text-sm text-[var(--text-main)] line-clamp-2">
                  {record.item_title || t("library.lending.unknownItem")}
                </h4>
                {isOverdue ? (
                  <Badge variant="destructive" className="shrink-0">
                    {t("library.lending.statusOverdue")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    {t("library.lending.statusLent")}
                  </Badge>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words font-medium text-[var(--text-main)]">
                  {record.contact_name}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] pt-1">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {t("library.lending.lentAt")}: {formatDate(record.lent_at, language)}
                </span>
                {record.due_date && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t("library.lending.dueDate")}: {formatDate(record.due_date, language)}
                  </span>
                )}
              </div>

              {record.notes && (
                <p className="break-words text-[11px] text-[var(--text-muted)] italic line-clamp-2 pt-1 border-t border-[var(--border-subtle)]">
                  &quot;{record.notes}&quot;
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="button"
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
