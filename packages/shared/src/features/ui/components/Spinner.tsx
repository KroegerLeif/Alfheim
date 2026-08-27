import * as React from "react";
import { cn } from "../utils/cn";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  /**
   * Accessible name for the busy state. Pass the caller's translated
   * "loading" string; defaults to "Loading" for the untranslated case.
   */
  label?: string;
}

const SIZES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-4",
};

/**
 * Indeterminate loading indicator. Renders as `role="status"` so assistive
 * technology announces the busy state rather than nothing.
 */
function Spinner({ className, size = "md", label = "Loading", ...props }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" {...props}>
      <div
        className={cn(
          "animate-spin rounded-full border-[var(--primary-main)] border-t-transparent",
          SIZES[size],
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export { Spinner };
