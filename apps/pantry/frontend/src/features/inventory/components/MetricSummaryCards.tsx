"use client";

import { useTranslation } from "@alfheim/shared";

interface MetricSummaryCardsProps {
  isLoading: boolean;
  totalStockQuantity: number;
  uniqueItemsCount: number;
  expiredCount: number;
  lowStockCount: number;
  untrackedCount: number;
}

/**
 * MetricSummaryCards
 * Renders the 4-column metric summary grid for the inventory dashboard.
 */
export function MetricSummaryCards({
  isLoading, totalStockQuantity, uniqueItemsCount,
  expiredCount, lowStockCount, untrackedCount,
}: MetricSummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
      <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-36 rounded-lg shadow-sm">
        <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t("pantry.totalStockLines")}</div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-4xl font-black text-[var(--text-main)]">{isLoading ? "--" : uniqueItemsCount}</span>
          <span className="text-xs text-[var(--text-muted)] uppercase">({isLoading ? "--" : totalStockQuantity.toFixed(1)} {t("pantry.quantity").toLowerCase()})</span>
        </div>
        <div className="text-[9px] text-[var(--text-muted)] mt-2 uppercase">{t("pantry.registeredBatches")}</div>
      </div>

      <div className={`border p-6 flex flex-col justify-between h-36 rounded-lg shadow-sm transition-colors ${expiredCount > 0 ? "border-red-600/60 bg-red-950/20 text-red-400" : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]"}`}>
        <div className="text-[10px] uppercase font-bold tracking-wider">{t("pantry.expirationAlerts")}</div>
        <div className="text-4xl font-black mt-2">{isLoading ? "--" : expiredCount}</div>
        <div className="text-[9px] uppercase font-mono">{expiredCount > 0 ? t("pantry.immediateAudit") : t("pantry.allValid")}</div>
      </div>

      <div className={`border p-6 flex flex-col justify-between h-36 rounded-lg shadow-sm transition-colors ${lowStockCount > 0 ? "border-amber-600/60 bg-amber-950/20 text-amber-400" : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]"}`}>
        <div className="text-[10px] uppercase font-bold tracking-wider">{t("pantry.lowStockLines")}</div>
        <div className="text-4xl font-black mt-2">{isLoading ? "--" : lowStockCount}</div>
        <div className="text-[9px] uppercase font-mono">{lowStockCount > 0 ? t("pantry.thresholdWarning") : t("pantry.stockQuotasMet")}</div>
      </div>

      <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-36 rounded-lg shadow-sm">
        <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t("pantry.untrackedBatches")}</div>
        <div className="text-4xl font-black mt-2 text-[var(--text-main)]">{isLoading ? "--" : untrackedCount}</div>
        <div className="text-[9px] text-[var(--text-muted)] uppercase font-mono">{t("pantry.noExpirationMapped")}</div>
      </div>
    </div>
  );
}
