import * as React from "react";
import { cn } from "../ui/utils/cn";

export interface MoneyDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  currency?: string;
  locale?: string;
  colored?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  showSign?: boolean;
}

const sizeClasses = {
  sm: "text-xs font-mono",
  md: "text-sm font-mono font-medium",
  lg: "text-lg font-mono font-semibold",
  xl: "text-2xl font-mono font-bold",
};

export function MoneyDisplay({
  amount,
  currency = "EUR",
  locale = "de-DE",
  colored = false,
  size = "md",
  showSign = false,
  className,
  ...props
}: MoneyDisplayProps) {
  const formatted = React.useMemo(() => {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      let result = formatter.format(amount);
      if (showSign && amount > 0) {
        result = `+${result}`;
      }
      return result;
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }, [amount, currency, locale, showSign]);

  const colorClass = React.useMemo(() => {
    if (!colored || amount === 0) return "";
    return amount > 0 ? "text-emerald-500" : "text-rose-500";
  }, [colored, amount]);

  return (
    <span
      className={cn(sizeClasses[size], colorClass, className)}
      {...props}
    >
      {formatted}
    </span>
  );
}
