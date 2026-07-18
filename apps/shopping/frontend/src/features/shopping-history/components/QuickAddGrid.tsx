"use client";

import { useTranslations } from "next-intl";
import { QuickTile } from "./QuickTile";
import { useShoppingHistory } from "../services/shoppingHistoryService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface QuickAddGridProps {
  onAdd: (name: string, unit: string) => void;
  disabled?: boolean;
}

/**
 * Grid block rendering purchase history quick addition triggers.
 */
export function QuickAddGrid({ onAdd, disabled = false }: QuickAddGridProps) {
  const t = useTranslations("History");
  const { data: history = [], isLoading } = useShoppingHistory();

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 flex flex-col min-h-0 relative overflow-hidden animate-pulse">
        <div className="h-4 w-28 bg-white/5 rounded-md mb-4" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 bg-white/5 rounded-xl" />
          <div className="h-20 bg-white/5 rounded-xl" />
          <div className="h-20 bg-white/5 rounded-xl" />
          <div className="h-20 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col min-h-0 relative overflow-hidden flex-1 select-none">
      <Specular opacityClassName="via-white/20 dark:via-white/10" />

      <div className="relative z-10 flex flex-col min-h-0 h-full">
        <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/45 mb-4 shrink-0">
          {t("title")}
        </h3>

        {/* Scrollable grid area */}
        <div className="flex-1 overflow-y-auto scrollbar-none min-h-0">
          <div className="grid grid-cols-2 gap-2 pb-1">
            {history.slice(0, 16).map((item) => (
              <QuickTile
                key={item.id}
                label={item.name}
                iconTag={item.icon_tag ?? null}
                onAdd={() => onAdd(item.name, item.unit)}
                disabled={disabled}
              />
            ))}
          </div>

          {history.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <span className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest">
                {t("noHistory")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
