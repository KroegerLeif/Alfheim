"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { Button } from "@alfheim/shared";
import { Send, Loader2, Check } from "lucide-react";
import { pushLowStockToShoppingApp } from "@/features/inventory/services/inventoryService";
import { LowStockItem } from "@/features/inventory/types";

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
  const [exportSuccess, setExportSuccess] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const res = await pushLowStockToShoppingApp();
      if (res.success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to sync low stock items with shopping app:", err);
    } finally {
      setIsExporting(false);
    }
  };

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
                lowStockItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-[var(--border-subtle)] pb-1.5">
                    <span className="font-bold uppercase truncate max-w-[150px] text-[var(--text-main)]">{item.product.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {item.current_stock.toFixed(1)} / {item.product.minimum_stock.toFixed(0)} Min
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-6">
        <Button onClick={handleExport} disabled={isExporting || lowStockItems.length === 0} variant="outline"
          className="w-full py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--surface-elevated)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-black cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg">
          {isExporting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.exportingLogistics")}</>
          ) : exportSuccess ? (
            <><Check className="h-4 w-4 text-emerald-400" />{t("pantry.listExported")}</>
          ) : (
            <><Send className="h-4 w-4" />{t("pantry.exportList")}</>
          )}
        </Button>
      </div>
    </div>
  );
}
