"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { GlassCheckbox } from "./GlassCheckbox";
import { PantryBadge } from "@/components/shared/PantryBadge";
import { ShoppingItem } from "../types";
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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => !isOptimistic && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "grid grid-cols-[22px_1fr_auto_auto] items-center gap-3 px-3 py-2.5 rounded-[12px] cursor-pointer",
        "transition-all duration-200 border-t border-b border-transparent select-none",
        item.is_completed ? "opacity-40" : "opacity-100",
        hovered && !item.is_completed
          ? "bg-blue-500/10 dark:bg-blue-500/5 border-t-blue-400/20 border-b-black/10 shadow-sm"
          : "bg-white/2 dark:bg-white/[0.01] border-b-black/5 dark:border-b-black/10"
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
          className={cn(
            "font-heading text-sm font-semibold tracking-wide truncate transition-all",
            item.is_completed
              ? "line-through text-muted-foreground/50"
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
      <div className="flex items-baseline gap-0.5 font-mono shrink-0 select-none">
        <span
          className={cn(
            "text-xs font-bold leading-none",
            item.is_completed
              ? "text-muted-foreground/30"
              : "text-blue-500 dark:text-blue-400"
          )}
        >
          {item.quantity}
        </span>
        <span className="text-[9px] font-bold text-muted-foreground/50 leading-none">
          {item.unit}
        </span>
      </div>

      {/* Actions container (hover triggers delete button) */}
      <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
        {!isOptimistic && hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-full h-full flex items-center justify-center rounded-[4px] 
                       hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
            aria-label="Remove item"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
