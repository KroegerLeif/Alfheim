"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInventoryState, useLedgerHistory } from "@/features/inventory/services/inventoryService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Loader2, BarChart2, PieChart } from "lucide-react";

/**
 * AnalyticsView Component
 * Renders high-contrast, pure-CSS Swiss Design visual charts.
 * 1. Consumption per Month: A vertical bar chart aggregating OUT/WASTE movements.
 * 2. Current Stock by Category: A horizontal layout chart grouping active inventory levels.
 */
export function AnalyticsView() {
  const t = useTranslations("Analytics");

  // Queries
  const { data: states = [], isLoading: isLoadingStates } = useInventoryState();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  // Fetch up to 100 transaction entries for historical logging
  const { data: transactions = [], isLoading: isLoadingLedger } = useLedgerHistory(undefined, undefined, 100);

  // Generate the last 6 months labels dynamically in chronological order
  const last6Months = React.useMemo(() => {
    const months = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ label, key });
    }
    return months;
  }, []);

  // 1. Calculate Monthly Consumption from Ledger History
  const monthlyConsumptionData = React.useMemo(() => {
    const consumptionMap: Record<string, number> = {};
    
    // Initialize map keys for the last 6 months
    last6Months.forEach(m => {
      consumptionMap[m.key] = 0;
    });

    // Aggregate OUT and WASTE movements
    transactions.forEach((tx) => {
      if (tx.transaction_type === "out" || tx.transaction_type === "waste") {
        const txDate = new Date(tx.created_at);
        const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
        
        // Only count if within our target 6-month window
        if (txMonthKey in consumptionMap) {
          consumptionMap[txMonthKey] += tx.quantity;
        }
      }
    });

    return last6Months.map(m => ({
      label: m.label,
      value: parseFloat(consumptionMap[m.key].toFixed(1)),
    }));
  }, [transactions, last6Months]);

  const maxConsumptionValue = React.useMemo(() => {
    const maxVal = Math.max(...monthlyConsumptionData.map((d) => d.value), 0);
    return maxVal === 0 ? 1 : maxVal;
  }, [monthlyConsumptionData]);

  // 2. Calculate Current Stock by Category
  const categoryStockData = React.useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    states.forEach((state) => {
      const catId = state.product?.category_id || "uncategorized";
      const qty = state.quantity;
      categoryTotals[catId] = (categoryTotals[catId] || 0) + qty;
    });

    const parsedCategories = Object.keys(categoryTotals).map((catId) => {
      let name = t("noCategory");
      if (catId !== "uncategorized") {
        const cat = categories.find((c) => c.id === catId);
        if (cat) {
          name = cat.name;
        }
      }
      return {
        name: name.toUpperCase(),
        value: parseFloat(categoryTotals[catId].toFixed(1)),
      };
    });

    // Sort categories descending by stock quantity
    return parsedCategories.sort((a, b) => b.value - a.value);
  }, [states, categories, t]);

  const maxStockValue = React.useMemo(() => {
    const maxVal = Math.max(...categoryStockData.map((d) => d.value), 0);
    return maxVal === 0 ? 1 : maxVal;
  }, [categoryStockData]);

  const isLoading = isLoadingStates || isLoadingCategories || isLoadingLedger;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background text-foreground font-mono p-8 space-y-6">
      {/* Header Banner */}
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none">
          {t("title")}
        </h1>
        <p className="uppercase tracking-widest text-[10px] text-muted-foreground mt-2 font-mono">
          {t("subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
            COMPILING METRICS...
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Card 1: Vertical Bar Chart (Consumption per Month) */}
          <div className="border border-border p-6 bg-white flex flex-col justify-between h-[450px]">
            <div className="space-y-1">
              <h2 className="text-xl font-heading font-black tracking-wide flex items-center gap-2">
                <BarChart2 className="h-5 w-5 shrink-0" />
                {t("consumptionTitle")}
              </h2>
              <div className="border-b border-neutral-100 pb-2"></div>
            </div>

            {/* Chart Area */}
            {maxConsumptionValue === 1 && monthlyConsumptionData.every(d => d.value === 0) ? (
              <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-widest p-8 text-center leading-relaxed">
                {t("noData")}
              </div>
            ) : (
              <div className="flex-1 flex items-end justify-between px-4 pt-12 h-64 border-b border-black">
                {monthlyConsumptionData.map((d, index) => {
                  const pctHeight = (d.value / maxConsumptionValue) * 100;
                  return (
                    <div key={index} className="flex flex-col items-center flex-1 group">
                      {/* Metric Hover Label */}
                      <span className="text-[10px] font-bold font-mono pb-2 text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {d.value}
                      </span>
                      
                      {/* CSS Solid Bar */}
                      <div 
                        style={{ height: `${pctHeight}%` }}
                        className="w-8 sm:w-12 bg-black hover:bg-neutral-800 transition-all select-none min-h-[4px]"
                      ></div>

                      {/* Month Label */}
                      <span className="text-xs font-heading font-bold mt-2 select-none">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend / Metrics Footer */}
            <div className="text-[9px] text-muted-foreground uppercase flex justify-between items-center select-none pt-4 border-t border-neutral-100">
              <span>Metric: {t("consumedLabel")} [Norm. Base Unit]</span>
              <span>Scale: Max {maxConsumptionValue.toFixed(0)}</span>
            </div>
          </div>

          {/* Card 2: Horizontal Bar Chart (Current Stock by Category) */}
          <div className="border border-border p-6 bg-white flex flex-col justify-between h-[450px]">
            <div className="space-y-1">
              <h2 className="text-xl font-heading font-black tracking-wide flex items-center gap-2">
                <PieChart className="h-5 w-5 shrink-0" />
                {t("categoryTitle")}
              </h2>
              <div className="border-b border-neutral-100 pb-2"></div>
            </div>

            {/* Chart Area */}
            {categoryStockData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-widest p-8 text-center leading-relaxed">
                {t("noStockData")}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 py-6 pr-2 max-h-[280px]">
                {categoryStockData.map((d, index) => {
                  const pctWidth = (d.value / maxStockValue) * 100;
                  return (
                    <div key={index} className="space-y-1 group">
                      <div className="flex items-center justify-between text-xs font-bold uppercase select-none">
                        <span>{d.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground group-hover:text-black transition-colors">
                          {d.value} {t("items")}
                        </span>
                      </div>
                      
                      {/* CSS Horizontal Bar Wrapper */}
                      <div className="w-full bg-neutral-100 h-5">
                        <div 
                          style={{ width: `${pctWidth}%` }}
                          className="bg-black hover:bg-neutral-800 transition-all h-full min-w-[4px]"
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend / Metrics Footer */}
            <div className="text-[9px] text-muted-foreground uppercase flex justify-between items-center select-none pt-4 border-t border-neutral-100">
              <span>Metric: {t("stockLabel")} [Norm. Base Unit]</span>
              <span>Sorted: High-to-Low</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
