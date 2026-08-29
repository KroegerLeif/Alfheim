import * as React from "react";
import { MoneyDisplay } from "./MoneyDisplay";
import { cn } from "../ui/utils/cn";

export interface MetricStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  amount: number;
  currency?: string;
  locale?: string;
  trendPercentage?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
}

export function MetricStatCard({
  title,
  amount,
  currency = "EUR",
  locale = "de-DE",
  trendPercentage,
  trendLabel,
  icon,
  className,
  ...props
}: MetricStatCardProps) {
  const isPositiveTrend = trendPercentage !== undefined && trendPercentage >= 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{title}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div>
        <MoneyDisplay amount={amount} currency={currency} locale={locale} size="xl" />
      </div>
      {(trendPercentage !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5 text-xs">
          {trendPercentage !== undefined && (
            <span
              className={cn(
                "font-mono font-medium",
                isPositiveTrend ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {isPositiveTrend ? "+" : ""}
              {trendPercentage.toFixed(1)}%
            </span>
          )}
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
