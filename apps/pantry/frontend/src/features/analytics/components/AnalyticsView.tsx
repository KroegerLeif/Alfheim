"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { useInventoryState, useLedgerHistory } from "@/features/inventory/services/inventoryService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Loader2 } from "lucide-react";
import { ConsumptionChart } from "./ConsumptionChart";
import { CategoryStockChart } from "./CategoryStockChart";

/**
 * AnalyticsView
 * Orchestrates the visual analytics panel:
 * - ConsumptionChart (6-month OUT/WASTE bar chart)
 * - CategoryStockChart (current stock by category horizontal bars)
 */
export function AnalyticsView() {
  const { t } = useTranslation();

  const { data: states = [], isLoading: isLoadingStates } = useInventoryState();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: transactions = [], isLoading: isLoadingLedger } = useLedgerHistory(undefined, undefined, 100);

  const isLoading = isLoadingStates || isLoadingCategories || isLoadingLedger;

  // Build last 6 months label/key pairs
  const last6Months = React.useMemo(() => {
    const date = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(date.getFullYear(), date.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      };
    });
  }, []);

  // Monthly consumption aggregation (OUT + WASTE transactions)
  const monthlyConsumptionData = React.useMemo(() => {
    const map: Record<string, number> = Object.fromEntries(last6Months.map((m) => [m.key, 0]));
    transactions.forEach((tx) => {
      if (tx.transaction_type === "out" || tx.transaction_type === "waste") {
        const key = `${new Date(tx.created_at).getFullYear()}-${String(new Date(tx.created_at).getMonth() + 1).padStart(2, "0")}`;
        if (key in map) map[key] += tx.quantity;
      }
    });
    return last6Months.map((m) => ({ label: m.label, value: parseFloat(map[m.key].toFixed(1)) }));
  }, [transactions, last6Months]);

  const maxConsumptionValue = Math.max(...monthlyConsumptionData.map((d) => d.value), 0) || 1;

  // Category stock aggregation
  const categoryStockData = React.useMemo(() => {
    const totals: Record<string, number> = {};
    states.forEach((state) => {
      const catId = state.product?.category_id ?? "uncategorized";
      totals[catId] = (totals[catId] ?? 0) + state.quantity;
    });
    return Object.entries(totals)
      .map(([catId, value]) => {
        const name = catId === "uncategorized"
          ? t("pantry.noCategory")
          : (categories.find((c) => c.id === catId)?.name ?? t("pantry.noCategory"));
        return { name: name.toUpperCase(), value: parseFloat(value.toFixed(1)) };
      })
      .sort((a, b) => b.value - a.value);
  }, [states, categories, t]);

  const maxStockValue = Math.max(...categoryStockData.map((d) => d.value), 0) || 1;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-canvas)] text-[var(--text-main)] font-mono p-8 space-y-6">
      <div className="border-b border-[var(--border-subtle)] pb-6">
        <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none text-[var(--text-main)]">{t("pantry.analyticsTitle")}</h1>
        <p className="uppercase tracking-widest text-[10px] text-[var(--text-muted)] mt-2 font-mono">{t("pantry.analyticsSub")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-main)]" />
          <span className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">{t("pantry.compilingMetrics")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <ConsumptionChart data={monthlyConsumptionData} maxValue={maxConsumptionValue} />
          <CategoryStockChart data={categoryStockData} maxValue={maxStockValue} />
        </div>
      )}
    </div>
  );
}
