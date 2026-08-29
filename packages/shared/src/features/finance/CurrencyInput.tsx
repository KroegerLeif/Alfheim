import * as React from "react";
import { cn } from "../ui/utils/cn";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number | string) => void;
  currencySymbol?: string;
  error?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      currencySymbol = "€",
      error,
      className,
      disabled,
      placeholder = "0.00",
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Allow empty string or numerical values with optional decimal point
      if (val === "" || /^\d*[.,]?\d*$/.test(val)) {
        onChange(val.replace(",", "."));
      }
    };

    return (
      <div className="w-full">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-sm text-muted-foreground select-none font-mono">
            {currencySymbol}
          </span>
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
