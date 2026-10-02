"use client";

import { ChoreInstanceRead } from "../types";
import { PieChart } from "lucide-react";
import { useTranslation } from "@alfheim/shared";

interface GoalDonutChartProps {
  chores: ChoreInstanceRead[];
}

export function GoalDonutChart({ chores = [] }: GoalDonutChartProps) {
  const { t } = useTranslation();

  // Real breakdown of today's chores by their actual status. ChoreTemplate has no
  // category concept, so this used to fabricate one from template_id UUID bytes --
  // that never reflected anything real about the chores (#502). Status is a real,
  // already-tracked field, so it replaces the fabricated categories here.
  const distribution = chores.reduce(
    (acc: Record<string, number>, inst) => {
      acc[inst.status] = (acc[inst.status] || 0) + 1;
      return acc;
    },
    { completed: 0, pending: 0, missed: 0 } as Record<string, number>
  );

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  const chartData = [
    { label: t("chores.completed"), count: distribution["completed"], color: "#10b981" },
    { label: t("chores.pending"), count: distribution["pending"], color: "#004ac6" },
    { label: t("chores.missed"), count: distribution["missed"], color: "#ef4444" },
  ].filter((d) => d.count > 0 || total === 0);

  // SVG parameters
  const size = 180;
  const radius = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 flex flex-col justify-between h-[280px] rounded-lg">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 mb-4 select-none">
        <PieChart className="h-4 w-4 text-[var(--primary-main)]" />
        <span className="font-mono text-xs uppercase font-bold text-[var(--text-main)]">
          {t("chores.statusDistribution")}
        </span>
      </div>

      <div className="flex items-center justify-around gap-4 flex-1">
        {/* SVG Donut */}
        <div className="relative h-[120px] w-[120px] shrink-0">
          {total === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--surface-elevated)] rounded-full">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{t("chores.empty")}</span>
            </div>
          ) : (
            <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="var(--border-subtle)"
                strokeWidth={strokeWidth}
              />
              {chartData.map((data, index) => {
                const percentage = data.count / total;
                const strokeDashoffset = circumference - percentage * circumference;
                const rotation = (currentOffset / total) * 360;
                currentOffset += data.count;

                return (
                  <circle
                    key={index}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={data.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${rotation - 90} ${center} ${center})`}
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                );
              })}
            </svg>
          )}
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5 font-mono text-xs text-[var(--text-main)] select-none">
          {chartData.map((data, idx) => {
            const pct = total > 0 ? Math.round((data.count / total) * 100) : 0;
            return (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                  <span className="truncate max-w-[90px]">{data.label}</span>
                </div>
                <span className="font-bold text-[var(--text-muted)]">
                  {pct}% ({data.count})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
