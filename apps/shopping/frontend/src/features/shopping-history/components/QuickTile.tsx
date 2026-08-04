"use client";

import { useState } from "react";
import {
  Apple, Milk, Carrot, Fish, Coffee, Wheat, Citrus,
  Egg, Cookie, Droplets, Leaf, ShoppingCart
} from "lucide-react";
import { Specular } from "@loeger-os/shared";
import { cn } from "@/lib/utils";

// Icon mapping configuration
export const getIconDetails = (tag?: string | null) => {
  const defaultMeta = { Icon: ShoppingCart, color: "#94a3b8" }; // Neutral slate
  
  if (!tag) return defaultMeta;

  switch (tag.toLowerCase()) {
    case "icon.grocery.milk":
      return { Icon: Milk, color: "#90b4ff" }; // Soft blue
    case "icon.grocery.cheese":
      return { Icon: Cookie, color: "#ffd93d" }; // Cheese gold
    case "icon.grocery.bread":
      return { Icon: Wheat, color: "#d4a76a" }; // Warm gold
    case "icon.grocery.fruit":
      return { Icon: Apple, color: "#ff6b6b" }; // Warm red
    case "icon.grocery.drinks":
      return { Icon: Droplets, color: "#64d2ff" }; // Soft cyan
    case "icon.grocery.meat":
      return { Icon: Fish, color: "#ff7f7f" }; // Warm coral
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
        "relative flex flex-col items-center justify-center gap-2 h-20 rounded-xl cursor-pointer overflow-hidden",
        "transition-all duration-300 ease-out select-none focus-visible:outline-2 focus-visible:outline-ring",
        hovered
          ? "glass-active scale-[1.045] shadow-md shadow-blue-500/10"
          : "glass-card hover:border-white/10"
      )}
    >
      {hovered && <Specular opacityClassName="via-white/35 dark:via-white/10" />}

      {/* Dynamic Colored Icon container */}
      <div
        style={{
          backgroundColor: hovered ? "rgba(0, 102, 255, 0.15)" : `${color}15`,
          borderColor: hovered ? "rgba(100, 160, 255, 0.3)" : `${color}35`,
          color: hovered ? "#5599FF" : color,
        }}
        className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border transition-all duration-300"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      </div>

      {/* Label */}
      <span
        className={cn(
          "font-heading text-[10px] font-black uppercase tracking-wider transition-colors duration-300 truncate max-w-[90%]",
          hovered ? "text-foreground" : "text-muted-foreground/60"
        )}
      >
        {label}
      </span>
    </button>
  );
}
