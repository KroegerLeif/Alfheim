"use client";

import { useState } from "react";
import { Search, ShoppingCart, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ItemRow } from "./ItemRow";
import {
  useShoppingListDetails,
  useUpdateShoppingItem,
  useDeleteShoppingItem,
} from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface ChecklistContainerProps {
  listId: string;
}

/**
 * Scrollable list view displaying items grouped by category with a bottom completed drawer.
 */
export function ChecklistContainer({ listId }: ChecklistContainerProps) {
  const t = useTranslations("Checklist");
  const [searchQuery, setSearchQuery] = useState("");

  // Queries & Mutations
  const { data: list, isLoading } = useShoppingListDetails(listId);
  const toggleItem = useUpdateShoppingItem(listId);
  const deleteItem = useDeleteShoppingItem(listId);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 animate-pulse">
        <div className="h-6 w-32 bg-white/5 rounded-md" />
        <div className="h-4 w-48 bg-white/5 rounded-md" />
      </div>
    );
  }

  if (!list) return null;

  const items = list.items || [];

  // Filter items by search query
  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  // Split into active and completed
  const activeItems = filteredItems.filter((i) => !i.is_completed);
  const completedItems = filteredItems.filter((i) => i.is_completed);

  // Group active items by category
  const categoriesMap: Record<string, typeof activeItems> = {};
  activeItems.forEach((item) => {
    // If the backend item has no category, default to a localized "Sonstiges" key
    const category = item.product_id ? "Pantry Stock" : "Sonstiges";
    if (!categoriesMap[category]) {
      categoriesMap[category] = [];
    }
    categoriesMap[category].push(item);
  });

  const categories = Object.keys(categoriesMap);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      <Specular opacityClassName="via-white/20 dark:via-white/10" />

      {/* Header bar (Search + Count info) */}
      <div className="flex items-center justify-between gap-4 p-5 border-b border-border/40 shrink-0">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-md font-heading font-black tracking-wider leading-none text-foreground">
            {list.name}
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
            {activeItems.length} {t("open")} · {completedItems.length} {t("completed")}
          </span>
        </div>

        {/* Local Search Input */}
        <div className="flex items-center gap-2 h-9 px-3 rounded-lg glass-inset select-none shrink-0 w-36 md:w-44">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none font-heading text-[13px] font-medium tracking-wide text-foreground min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="cursor-pointer text-muted-foreground/50 hover:text-foreground shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Checklist scroll area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none min-h-0">
        {/* Render grouped category items */}
        {categories.map((cat) => (
          <div key={cat} className="space-y-1.5">
            <div className="font-mono text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-3 select-none">
              {cat}
            </div>
            <div className="space-y-1">
              {categoriesMap[cat].map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() =>
                    toggleItem.mutate({
                      itemId: item.id,
                      payload: { is_completed: !item.is_completed },
                    })
                  }
                  onDelete={() => deleteItem.mutate(item.id)}
                  isOptimistic={item.id.startsWith("temp-") || !item.created_at}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Render completed items at the bottom */}
        {completedItems.length > 0 && (
          <div className="pt-3 border-t border-border/20">
            <div className="font-mono text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest px-3 mb-2 text-center select-none">
              {t("completed")} ({completedItems.length})
            </div>
            <div className="space-y-1">
              {completedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() =>
                    toggleItem.mutate({
                      itemId: item.id,
                      payload: { is_completed: !item.is_completed },
                    })
                  }
                  onDelete={() => deleteItem.mutate(item.id)}
                  isOptimistic={item.id.startsWith("temp-") || !item.created_at}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty layout view */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center glass-inset">
              <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest select-none">
              {t("empty")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
