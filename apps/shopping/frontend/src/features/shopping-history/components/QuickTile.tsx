"use client";

import { useState } from "react";
import {
  Apple, Milk, Fish, Wheat,
  Cookie, Droplets, ShoppingCart
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
  disabled?: boolean;
}

/**
 * Clickable card triggering quick additions of frequently purchased items.
 */
export function QuickTile({ label, iconTag, onAdd, disabled = false }: QuickTileProps) {
  const [hovered, setHovered] = useState(false);
  const { Icon, color } = getIconDetails(iconTag);

  return (
    <button
      onClick={onAdd}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 h-20 rounded-xl cursor-pointer overflow-hidden border",
        "transition-all duration-200 ease-out select-none focus-visible:outline-2 focus-visible:outline-ring",
        hovered
          ? "bg-[var(--surface-elevated)] border-[var(--primary-main)]/50 scale-[1.03] shadow-md"
          : "bg-[var(--surface-canvas)] border-[var(--border-subtle)]"
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
      <span
        className={cn(
          "font-heading text-[10px] font-bold uppercase tracking-wider truncate max-w-[90%]",
          hovered ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"
        )}
      >
        {label}
      </span>
    </button>
  );
}
