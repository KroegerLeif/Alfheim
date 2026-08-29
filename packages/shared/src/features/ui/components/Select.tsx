import * as React from "react";
import { cn } from "../utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  /** Rendered as a disabled, empty-valued first option. */
  placeholder?: string;
}

/**
 * Native select primitive — keyboard and screen-reader behavior come from the
 * platform, and mobile browsers render their own picker. Height is 44px to
 * satisfy the minimum touch-target size.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full h-11 px-3 rounded text-sm font-mono uppercase cursor-pointer",
        "border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)]",
        "focus:outline-none focus:border-[var(--primary-main)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {(options ?? []).map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
