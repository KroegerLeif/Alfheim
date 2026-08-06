"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { Plus, Minus } from "lucide-react";
import { useInventoryState, useLowStockItems, useExpirationSummary } from "@/features/inventory/services/inventoryService";
import { StockActionModal } from "./StockActionModal";
import { MetricSummaryCards } from "./MetricSummaryCards";
import { AlertsFeed } from "./AlertsFeed";
import { ShoppingSyncPanel } from "./ShoppingSyncPanel";

/**
 * DashboardView
 * Orchestrates the main operational panel:
 * - MetricSummaryCards (aggregate KPIs)
 * - Quick stock IN/OUT action buttons
 * - AlertsFeed (expiration urgency log)
 * - ShoppingSyncPanel (low-stock → shopping export)
 * - StockActionModal (transaction entry)
 */
export function DashboardView() {
  const { t } = useTranslation();

  const { data: states = [], isLoading: isLoadingStates } = useInventoryState();
  const { data: lowStockItems = [], isLoading: isLoadingLowStock } = useLowStockItems();
  const { data: expirationSummary, isLoading: isLoadingExp } = useExpirationSummary();

  const [modalMode, setModalMode] = React.useState<"in" | "out">("in");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const isLoadingMetrics = isLoadingStates || isLoadingLowStock || isLoadingExp;

  const totalStockQuantity = states.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueItemsCount = states.length;
  const expiredCount = expirationSummary?.expired?.length ?? 0;
  const lowStockCount = lowStockItems.length;
  const untrackedCount = expirationSummary?.untracked?.length ?? 0;

  // Compile sorted alert feed: expired items first, then items expiring within 14 days
  const alertFeed = React.useMemo(() => {
    const expiredFeed = (expirationSummary?.expired ?? []).map((item) => ({ ...item, severity: "high" as const }));
    const warningFeed = (expirationSummary?.valid ?? [])
      .filter((item) => {
        if (!item.expiration_date) return false;
        const diffDays = Math.ceil((new Date(item.expiration_date).getTime() - Date.now()) / 86_400_000);
        return diffDays >= 0 && diffDays <= 14;
      })
      .map((item) => ({ ...item, severity: "medium" as const }))
      .sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime());
    return [...expiredFeed, ...warningFeed];
  }, [expirationSummary]);

  return (
    <div className="flex-1 p-6 md:p-12 space-y-10 max-w-7xl mx-auto w-full select-none text-[var(--text-main)]">

      {/* KPI Summary */}
      <MetricSummaryCards
        isLoading={isLoadingMetrics}
        totalStockQuantity={totalStockQuantity}
        uniqueItemsCount={uniqueItemsCount}
        expiredCount={expiredCount}
        lowStockCount={lowStockCount}
        untrackedCount={untrackedCount}
      />

      {/* Quick Stock IN / OUT action row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
        <button onClick={() => { setModalMode("in"); setIsModalOpen(true); }}
          className="border-2 border-[var(--border-subtle)] bg-[var(--surface-card)] h-32 px-8 flex items-center justify-between text-left hover:border-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-all duration-200 cursor-pointer group rounded-lg shadow-sm">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--primary-main)]">{t("pantry.quickTransaction")}</div>
            <h2 className="text-4xl font-black uppercase mt-1 text-[var(--text-main)]">{t("pantry.stockIn")}</h2>
          </div>
          <div className="h-14 w-14 border border-[var(--border-subtle)] flex items-center justify-center bg-[var(--surface-canvas)] group-hover:border-[var(--primary-main)] group-hover:bg-[var(--primary-main)]/10 transition-colors rounded-lg">
            <Plus className="h-6 w-6 text-[var(--text-main)] group-hover:text-[var(--primary-main)]" />
          </div>
        </button>

        <button onClick={() => { setModalMode("out"); setIsModalOpen(true); }}
          className="border-2 border-[var(--border-subtle)] bg-[var(--surface-card)] h-32 px-8 flex items-center justify-between text-left hover:border-red-500 hover:bg-red-950/10 transition-all duration-200 cursor-pointer group rounded-lg shadow-sm">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-red-400">{t("pantry.quickTransaction")}</div>
            <h2 className="text-4xl font-black uppercase mt-1 text-[var(--text-main)]">{t("pantry.stockOut")}</h2>
          </div>
          <div className="h-14 w-14 border border-[var(--border-subtle)] flex items-center justify-center bg-[var(--surface-canvas)] group-hover:border-red-500 group-hover:bg-red-950/20 transition-colors rounded-lg">
            <Minus className="h-6 w-6 text-[var(--text-main)] group-hover:text-red-400" />
          </div>
        </button>
      </div>

      {/* Alerts + Shopping sync */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
        <AlertsFeed isLoading={isLoadingMetrics} alertFeed={alertFeed} />
        <ShoppingSyncPanel isLoading={isLoadingMetrics} lowStockItems={lowStockItems} />
      </div>

      <StockActionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} mode={modalMode} />
    </div>
  );
}
