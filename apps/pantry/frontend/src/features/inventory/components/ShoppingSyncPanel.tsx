"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { Button } from "@alfheim/shared";
import { Send, Loader2, RotateCw } from "lucide-react";
import { pushLowStockToShopping } from "@/features/inventory/services/shoppingExport";
import { LowStockItem } from "@/features/inventory/types";
import { ShoppingExportNotice } from "./ShoppingExportNotice";

interface ShoppingSyncPanelProps {
  isLoading: boolean;
  lowStockItems: LowStockItem[];
}

/**
 * ShoppingSyncPanel
 * Renders the low-stock quota violations list and cross-service shopping export action.
 */
export function ShoppingSyncPanel({ isLoading, lowStockItems }: ShoppingSyncPanelProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = React.useState(false);
  const [outcome, setOutcome] = React.useState<{ sentCount: number; failed: LowStockItem[] } | null>(null);

  /** Exports `items`; a retry only sends the previously failed items and keeps counting what arrived. */
  const runExport = async (items: LowStockItem[], alreadySent: number) => {
    setIsExporting(true);
    try {
      const result = await pushLowStockToShopping(items);
      setOutcome({ sentCount: alreadySent + result.sent.length, failed: result.failed });
    } finally {
      setIsExporting(false);
    }
  };

  const hasFailures = (outcome?.failed.length ?? 0) > 0;
  const handleExport = () =>
    hasFailures && outcome ? runExport(outcome.failed, outcome.sentCount) : runExport(lowStockItems, 0);

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex flex-col justify-between min-h-[400px] rounded-lg shadow-sm">
      <div>
        <h2 className="font-heading text-2xl font-black border-b border-[var(--border-subtle)] pb-3 mb-4 uppercase tracking-wide text-[var(--text-main)]">
          {t("pantry.shoppingList")}
        </h2>
        <p className="text-xs text-[var(--text-muted)] uppercase leading-relaxed tracking-wide font-sans">{t("pantry.shoppingListDesc")}</p>

        <div className="mt-6 space-y-3">
          <div className="text-xs uppercase font-bold text-[var(--text-muted)]">{t("pantry.quotaViolations")}</div>
          {isLoading ? (
            <div className="text-xs text-[var(--text-muted)]">{t("pantry.calculating")}</div>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {lowStockItems.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)]">{t("pantry.allQuotasSatisfied")}</div>
              ) : (
                lowStockItems.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-center text-xs border-b border-[var(--border-subtle)] pb-1.5">
                    <span className="font-bold uppercase truncate min-w-0 text-[var(--text-main)]" title={item.product.name}>
                      {item.product.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0 pl-2">
                      {t("pantry.stockOfMinimum", {
                        current: item.current_stock.toFixed(1),
                        minimum: item.product.minimum_stock.toFixed(0),
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 space-y-3">
        {outcome && <ShoppingExportNotice sentCount={outcome.sentCount} failed={outcome.failed} />}
        <Button type="button" onClick={handleExport} disabled={isExporting || lowStockItems.length === 0} variant="outline"
          className="w-full py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--surface-elevated)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-black cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg">
          {isExporting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.exportingLogistics")}</>
          ) : hasFailures ? (
            <><RotateCw className="h-4 w-4" />{t("pantry.export.retryFailed")}</>
          ) : (
            <><Send className="h-4 w-4" />{t("pantry.exportList")}</>
          )}
        </Button>
      </div>
    </div>
  );
}
