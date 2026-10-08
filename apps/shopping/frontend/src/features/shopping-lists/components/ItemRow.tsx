"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { GlassCheckbox } from "./GlassCheckbox";
import { PantryBadge } from "@/components/shared/PantryBadge";
import { ShoppingItem } from "../types";
import { unitLabel } from "../utils/units";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  isOptimistic?: boolean;
}

/**
 * Renders an interactive, touch-optimized row in the checklist.
 */
export function ItemRow({ item, onToggle, onDelete, isOptimistic = false }: ItemRowProps) {
  const t = useTranslations("Checklist");
  const tUnits = useTranslations("Units");
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={isOptimistic ? undefined : onToggle}
      onMouseEnter={() => !isOptimistic && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "grid grid-cols-[22px_minmax(0,1fr)_auto_24px] items-center gap-3 px-3 py-2.5 rounded-xl",
        isOptimistic ? "cursor-progress" : "cursor-pointer",
        "transition-all duration-200 border border-transparent select-none",
        item.is_completed ? "opacity-50 glass-inset" : "glass-card hover:glass-active",
        hovered && !item.is_completed && "border-blue-500/20 shadow-xs"
      )}
    >
      {/* Tactile Checkbox */}
      <GlassCheckbox
        checked={item.is_completed}
        onChange={onToggle}
        disabled={isOptimistic}
      />

      {/* Item details */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          title={item.brand ? `${item.name} (${item.brand})` : item.name}
          className={cn(
            "font-heading text-sm font-bold tracking-wide truncate min-w-0 transition-all duration-300",
            item.is_completed
              ? "line-through text-muted-foreground/60"
              : "text-foreground"
          )}
        >
          {item.name}
          {item.brand && (
            <span className="text-xs text-muted-foreground/60 font-mono font-medium ml-1.5 uppercase">
              ({item.brand})
            </span>
          )}
        </span>

        {/* Linked Catalog Badge */}
        {item.product_id && !item.is_completed && <PantryBadge />}
      </div>

      {/* Quantities & units */}
      <div className="flex items-baseline gap-1 font-mono shrink-0 max-w-[8rem] select-none">
        <span
          className={cn(
            "text-xs font-black leading-none truncate",
            item.is_completed
              ? "text-muted-foreground/40"
              : "text-primary"
          )}
        >
          {item.quantity}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground/60 leading-none truncate">
          {unitLabel(item.unit, tUnits)}
        </span>
      </div>

      {/* Actions container (hover triggers delete button) */}
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {!isOptimistic && (hovered || item.is_completed) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            aria-label={t("removeItem")}
            title={t("removeItem")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
