import * as React from "react";
import { cn } from "../utils/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional inline label rendered to the right of the box. */
  label?: string;
}

/**
 * Native checkbox primitive. When `label` is supplied the whole row is the hit
 * area and is at least 44px tall, so it stays usable as a touch target.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const box = (
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className={cn(
          // accent-color keeps the platform checkmark and focus behavior while
          // tinting the control with the active theme's primary token.
          "h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary-main)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary-main)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );

    if (!label) return box;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-center gap-3 min-h-11 select-none",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        )}
      >
        {box}
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
          {label}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
