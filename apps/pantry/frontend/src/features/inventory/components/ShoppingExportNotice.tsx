"use client";

import { useTranslation } from "@alfheim/shared";
import { CheckCircle2 } from "lucide-react";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LowStockItem } from "@/features/inventory/types";

interface ShoppingExportNoticeProps {
  /** Number of items that reached the shopping list so far. */
  sentCount: number;
  /** Items the shopping app rejected or that never arrived; shown so the user knows what is missing. */
  failed: LowStockItem[];
}

/**
 * ShoppingExportNotice
 * Reports the outcome of a low-stock export: full success, partial success with the missing
 * items, or complete failure.
 */
export function ShoppingExportNotice({ sentCount, failed }: ShoppingExportNoticeProps) {
  const { t } = useTranslation();

  if (failed.length === 0) {
    return (
      <div
        role="status"
        className="border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 p-3 text-xs flex items-start gap-2 font-bold rounded min-w-0"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span className="min-w-0 break-words">{t("pantry.export.sent", { count: sentCount })}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      <ErrorBanner
        message={
          sentCount === 0
            ? t("pantry.export.failedAll", { count: failed.length })
            : t("pantry.export.failedSome", { failed: failed.length, sent: sentCount })
        }
      />
      <ul className="max-h-24 overflow-y-auto space-y-1 text-[10px] text-[var(--text-muted)] uppercase">
        {failed.map((item) => (
          <li key={item.product.id} className="truncate" title={item.product.name}>
            {item.product.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
