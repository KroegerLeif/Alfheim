"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Apple,
  Banana,
  Milk,
  Carrot,
  Coffee,
  Egg,
  Beef,
  Cookie,
  Pizza,
  Wine,
  Sparkles,
  ShoppingBag,
  Package,
  Box,
  Tag,
  Utensils,
  CupSoda,
  Flame,
  Heart,
  Star,
  Check,
  Smile,
} from "lucide-react";

export interface IconOption {
  id: string;
  name: string;
  component: React.ComponentType<{ className?: string }>;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { id: "apple", name: "Apple", component: Apple },
  { id: "banana", name: "Banana", component: Banana },
  { id: "milk", name: "Milk", component: Milk },
  { id: "carrot", name: "Carrot", component: Carrot },
  { id: "coffee", name: "Coffee", component: Coffee },
  { id: "egg", name: "Egg", component: Egg },
  { id: "beef", name: "Beef", component: Beef },
  { id: "cookie", name: "Cookie", component: Cookie },
  { id: "pizza", name: "Pizza", component: Pizza },
  { id: "wine", name: "Wine", component: Wine },
  { id: "sparkles", name: "Sparkles", component: Sparkles },
  { id: "bag", name: "Shopping Bag", component: ShoppingBag },
  { id: "package", name: "Package", component: Package },
  { id: "box", name: "Box", component: Box },
  { id: "tag", name: "Tag", component: Tag },
  { id: "utensils", name: "Utensils", component: Utensils },
  { id: "soda", name: "Soda", component: CupSoda },
  { id: "flame", name: "Flame", component: Flame },
  { id: "heart", name: "Heart", component: Heart },
  { id: "star", name: "Star", component: Star },
  { id: "smile", name: "Smile", component: Smile },
];

interface IconPickerProps {
  selectedIconId: string | null;
  onSelectIcon: (iconId: string) => void;
  className?: string;
}

export function IconPicker({ selectedIconId, onSelectIcon, className = "" }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentIconObj = AVAILABLE_ICONS.find((i) => i.id === selectedIconId) || AVAILABLE_ICONS[0];
  const CurrentIcon = currentIconObj.component;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 rounded-xl glass-inset hover:glass-active border border-border/40 flex items-center justify-center text-primary cursor-pointer transition-all duration-200"
        title="Select Icon"
        aria-label="Select Icon"
      >
        <CurrentIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-12 w-64 bg-card border border-border/60 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
            Select Icon
          </div>

          <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto scrollbar-none p-1 bg-background/50 rounded-xl border border-border/30">
            {AVAILABLE_ICONS.map((iconItem) => {
              const IconComp = iconItem.component;
              const isSelected = selectedIconId === iconItem.id;

              return (
                <button
                  key={iconItem.id}
                  type="button"
                  onClick={() => {
                    onSelectIcon(iconItem.id);
                    setIsOpen(false);
                  }}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-md scale-105"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                  title={iconItem.name}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
