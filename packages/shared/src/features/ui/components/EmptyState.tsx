import * as React from "react";
import { cn } from "../utils/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  /** Decorative glyph rendered above the title. */
  icon?: React.ReactNode;
  /** Primary call to action, e.g. a "create" Button. */
  action?: React.ReactNode;
}

/**
 * Placeholder for a list or panel that has no content yet. All copy is passed
 * in by the caller so it stays translatable.
 */
function EmptyState({ className, title, description, icon, action, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 rounded-lg p-12",
        "border border-dashed border-[var(--border-subtle)]",
        className
      )}
      {...props}
    >
      {icon && (
        <div aria-hidden="true" className="text-[var(--text-faint)]">
          {icon}
        </div>
      )}
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-[var(--text-faint)]">{description}</p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };
