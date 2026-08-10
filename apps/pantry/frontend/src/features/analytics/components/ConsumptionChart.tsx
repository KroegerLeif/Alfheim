"use client";

import { useTranslation } from "@alfheim/shared";
import { BarChart2 } from "lucide-react";

interface MonthData { label: string; value: number; }

interface ConsumptionChartProps {
  data: MonthData[];
  maxValue: number;
}

/**
 * ConsumptionChart
 * Vertical bar chart for monthly OUT/WASTE consumption over the last 6 months.
 */
export function ConsumptionChart({ data, maxValue }: ConsumptionChartProps) {
  const { t } = useTranslation();
  const isEmpty = maxValue === 1 && data.every((d) => d.value === 0);

  return (
    <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-[450px] rounded-lg shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-heading font-black tracking-wide flex items-center gap-2 text-[var(--text-main)]">
          <BarChart2 className="h-5 w-5 shrink-0 text-[var(--primary-main)]" />{t("pantry.consumptionTitle")}
        </h2>
        <div className="border-b border-[var(--border-subtle)] pb-2" />
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center text-[10px] text-[var(--text-muted)] uppercase tracking-widest p-8 text-center leading-relaxed">
          {t("pantry.noData")}
        </div>
      ) : (
        <div className="flex-1 flex items-end justify-between px-4 pt-12 h-64 border-b border-[var(--border-subtle)]">
          {data.map((d, index) => (
            <div key={index} className="flex flex-col items-center flex-1 group">
              <span className="text-[10px] font-bold font-mono pb-2 text-[var(--primary-main)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">{d.value}</span>
              <div style={{ height: `${(d.value / maxValue) * 100}%` }}
                className="w-8 sm:w-12 bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] transition-all select-none min-h-[4px] rounded-t" />
              <span className="text-xs font-heading font-bold mt-2 select-none text-[var(--text-main)]">{d.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-[var(--text-muted)] uppercase flex justify-between items-center select-none pt-4 border-t border-[var(--border-subtle)]">
        <span>{t("pantry.metricConsumed")}</span>
        <span>{t("pantry.scaleMax", { max: maxValue.toFixed(0) })}</span>
      </div>
    </div>
  );
}
