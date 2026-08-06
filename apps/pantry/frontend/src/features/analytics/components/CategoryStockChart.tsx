"use client";

import { useTranslation } from "@loeger-os/shared";
import { PieChart } from "lucide-react";

interface CategoryData { name: string; value: number; }

interface CategoryStockChartProps {
  data: CategoryData[];
  maxValue: number;
}

/**
 * CategoryStockChart
 * Horizontal bar chart showing current stock quantities grouped by category.
 */
export function CategoryStockChart({ data, maxValue }: CategoryStockChartProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-[450px] rounded-lg shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-heading font-black tracking-wide flex items-center gap-2 text-[var(--text-main)]">
          <PieChart className="h-5 w-5 shrink-0 text-[var(--primary-main)]" />{t("pantry.categoryTitle")}
        </h2>
        <div className="border-b border-[var(--border-subtle)] pb-2" />
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[10px] text-[var(--text-muted)] uppercase tracking-widest p-8 text-center leading-relaxed">
          {t("pantry.noStockData")}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 py-6 pr-2 max-h-[280px]">
          {data.map((d, index) => (
            <div key={index} className="space-y-1 group">
              <div className="flex items-center justify-between text-xs font-bold uppercase select-none">
                <span className="text-[var(--text-main)]">{d.name}</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] group-hover:text-[var(--primary-main)] transition-colors">
                  {d.value} {t("pantry.items")}
                </span>
              </div>
              <div className="w-full bg-[var(--surface-elevated)] h-5 rounded">
                <div style={{ width: `${(d.value / maxValue) * 100}%` }}
                  className="bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] transition-all h-full min-w-[4px] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-[var(--text-muted)] uppercase flex justify-between items-center select-none pt-4 border-t border-[var(--border-subtle)]">
        <span>{t("pantry.metricStock")}</span>
        <span>{t("pantry.sortedHighToLow")}</span>
      </div>
    </div>
  );
}
