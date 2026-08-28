import * as React from "react";
import { Progress } from "../ui/components/Progress";
import { MoneyDisplay } from "./MoneyDisplay";
import { cn } from "../ui/utils/cn";

export interface BucketMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  currentAmount: number;
  targetAmount: number;
  priority?: number;
  currency?: string;
}

export function BucketMeter({
  name,
  currentAmount,
  targetAmount,
  priority,
  currency = "EUR",
  className,
  ...props
}: BucketMeterProps) {
  const percentage = Math.min(
    100,
    Math.max(0, targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0)
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {priority !== undefined && (
            <span className="inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-muted-foreground shrink-0">
              P{priority}
            </span>
          )}
          <span className="font-medium text-sm truncate">{name}</span>
        </div>
        <div className="text-right shrink-0">
          <MoneyDisplay amount={currentAmount} currency={currency} size="sm" />
          <span className="text-xs text-muted-foreground mx-1">/</span>
          <MoneyDisplay
            amount={targetAmount}
            currency={currency}
            size="sm"
            className="text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Progress
          value={percentage}
          aria-label={`${name} progress`}
          className="h-2 flex-1"
        />
        <span className="text-xs font-mono text-muted-foreground shrink-0 min-w-[3.5rem] text-right">
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
