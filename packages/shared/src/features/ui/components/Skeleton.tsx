import * as React from "react";
import { cn } from "../utils/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Content placeholder shown while data loads. Hidden from assistive
 * technology — announce the busy state with `Spinner` or an aria-live region
 * instead of exposing decorative boxes.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-[var(--surface-elevated)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
