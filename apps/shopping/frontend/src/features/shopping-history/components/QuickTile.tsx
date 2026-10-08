"use client";

import {
  Apple, Milk, Fish, Wheat,
  Cookie, Droplets, ShoppingCart, X
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping configuration
export const getIconDetails = (tag?: string | null) => {
  const defaultMeta = { Icon: ShoppingCart, color: "var(--text-muted)" };
  if (!tag) return defaultMeta;

  switch (tag.toLowerCase()) {
    case "icon.grocery.milk":
      return { Icon: Milk, color: "var(--accent-cyan)" };
    case "icon.grocery.cheese":
      return { Icon: Cookie, color: "var(--accent-gold)" };
    case "icon.grocery.bread":
      return { Icon: Wheat, color: "var(--accent-gold)" };
    case "icon.grocery.fruit":
      return { Icon: Apple, color: "#ef4444" };
    case "icon.grocery.drinks":
      return { Icon: Droplets, color: "var(--accent-cyan)" };
    case "icon.grocery.meat":
      return { Icon: Fish, color: "#f87171" };
    default:
      return defaultMeta;
  }
};

interface QuickTileProps {
  label: string;
  iconTag: string | null;
  onAdd: () => void;
  /** Removes the entry from the frequently bought grid. */
  onRemove: () => void;
  /** Localized accessible name of the remove button. */
  removeLabel: string;
  disabled?: boolean;
  removeDisabled?: boolean;
}

/**
 * Clickable card triggering quick additions of frequently purchased items, with a remove button
 * that is revealed on hover or keyboard focus (always visible on touch devices).
 */
export function QuickTile({
  label,
  iconTag,
  onAdd,
  onRemove,
  removeLabel,
  disabled = false,
  removeDisabled = false,
}: QuickTileProps) {
  const { Icon, color } = getIconDetails(iconTag);

  return (
    <div className="relative group min-w-0">
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        title={label}
        className={cn(
          "relative w-full flex flex-col items-center justify-center gap-2 h-20 rounded-xl cursor-pointer overflow-hidden border",
          "transition-all duration-200 ease-out select-none focus-visible:outline-2 focus-visible:outline-ring",
          "bg-[var(--surface-canvas)] border-[var(--border-subtle)]",
          "hover:bg-[var(--surface-elevated)] hover:border-[var(--primary-main)]/50 hover:scale-[1.03] hover:shadow-md disabled:cursor-not-allowed"
        )}
      >
        {/* Icon container */}
        <div
          style={{ color }}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface-card)] border border-[var(--border-subtle)]"
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        </div>

        {/* Label */}
        <span className="font-heading text-[10px] font-bold uppercase tracking-wider truncate max-w-[80%] text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
          {label}
        </span>
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={removeDisabled}
        aria-label={removeLabel}
        title={removeLabel}
        className={cn(
          "absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded-md cursor-pointer",
          "bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity disabled:opacity-40"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
