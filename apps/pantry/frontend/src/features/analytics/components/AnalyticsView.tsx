"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useInventoryState } from "@/features/inventory/services/inventoryService";
import { useCategories } from "@/features/categories/services/categoryService";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Loader2 } from "lucide-react";
import { useConsumptionLedger } from "../services/consumptionService";
import { bucketMonthlyConsumption } from "../utils/consumption";
import { ConsumptionChart } from "./ConsumptionChart";
import { CategoryStockChart } from "./CategoryStockChart";

/**
 * AnalyticsView
 * Orchestrates the visual analytics panel:
 * - ConsumptionChart (6-month OUT/WASTE bar chart over the full period)
 * - CategoryStockChart (current stock by category horizontal bars)
 */
export function AnalyticsView() {
  const { t, language } = useTranslation();

  const { data: statesData, isLoading: isLoadingStates, isError: isStatesError } = useInventoryState();
  const states = statesData ?? [];
  const { data: categoriesData, isLoading: isLoadingCategories, isError: isCategoriesError } = useCategories();
  const categories = categoriesData ?? [];
  const { data: consumption, isLoading: isLoadingLedger, isError: isLedgerError } = useConsumptionLedger();

  const isLoading = isLoadingStates || isLoadingCategories || isLoadingLedger;
  const isError = isStatesError || isCategoriesError || isLedgerError;

  // Monthly consumption aggregation (OUT + WASTE transactions) over every ledger row of the window
  const monthlyConsumptionData = React.useMemo(
    () => bucketMonthlyConsumption(consumption?.rows ?? [], new Date(), language),
    [consumption, language]
  );

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
        <h1 className="text-2xl sm:text-4xl font-heading font-black tracking-wide leading-none select-none text-[var(--text-main)]">{t("pantry.analyticsTitle")}</h1>
        <p className="uppercase tracking-widest text-[10px] text-[var(--text-muted)] mt-2 font-mono">{t("pantry.analyticsSub")}</p>
      </div>

      {isError && <ErrorBanner message={t("pantry.errors.loadAnalytics")} />}
      {consumption?.truncated && <ErrorBanner message={t("pantry.analyticsTruncated")} />}

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
