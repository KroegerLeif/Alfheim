"use client";

import { useShoppingLists } from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface ListSelectorProps {
  activeListId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Tab switcher displaying active lists and counts, styled as a glassy segment nav.
 */
export function ListSelector({ activeListId, onSelect }: ListSelectorProps) {
  const { data: lists = [], isLoading } = useShoppingLists();

  if (isLoading) {
    return (
      <div className="flex gap-2 shrink-0">
        <div className="h-11 w-28 rounded-2xl glass-card animate-pulse" />
        <div className="h-11 w-28 rounded-2xl glass-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="shrink-0 max-w-full overflow-x-auto scrollbar-none">
      <div className="inline-flex p-1.5 rounded-2xl glass-card relative overflow-hidden shrink-0 select-none">
        <Specular opacityClassName="via-white/30 dark:via-white/10" />
        
        <div className="flex gap-1 relative z-10">
          {lists.map((list) => {
            const isActive = activeListId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => onSelect(list.id)}
                className={cn(
                  "flex items-center gap-2 h-9 px-5 rounded-xl cursor-pointer transition-all duration-300 font-heading text-xs font-extrabold uppercase tracking-wider outline-none",
                  isActive
                    ? "glass-active text-foreground font-black"
                    : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{list.name}</span>
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold leading-none px-1 py-0.5 rounded",
                    isActive
                      ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                      : "bg-white/5 text-muted-foreground/50"
                  )}
                >
                  {list.items.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
