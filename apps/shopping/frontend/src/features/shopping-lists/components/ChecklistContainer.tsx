"use client";

import { useState } from "react";
import { Search, ShoppingCart, X, CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { ItemRow } from "./ItemRow";
import {
  useShoppingListDetails,
  useUpdateShoppingItem,
  useDeleteShoppingItem,
} from "../services/shoppingListService";
import { getCategoryKeyForItem } from "../utils/category";
import { Specular } from "@loeger-os/shared";

interface ChecklistContainerProps {
  listId: string;
}

/**
 * Scrollable list view displaying items grouped by category with search and completed drawer.
 */
export function ChecklistContainer({ listId }: ChecklistContainerProps) {
  const t = useTranslations("Checklist");
  const tCat = useTranslations("Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);

  // Queries & Mutations
  const { data: list, isLoading } = useShoppingListDetails(listId);
  const toggleItem = useUpdateShoppingItem(listId);
  const deleteItem = useDeleteShoppingItem(listId);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 animate-pulse">
        <div className="h-6 w-32 bg-muted/40 rounded-md" />
        <div className="h-4 w-48 bg-muted/30 rounded-md" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <Specular opacityClassName="via-white/20 dark:via-white/10" />
        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 shrink-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center glass-inset">
            <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest select-none">
            {t("empty")}
          </span>
        </div>
      </div>
    );
  }

  const items = list?.items ?? [];

  // Filter items by search query
  const filteredItems = searchQuery
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  // Split into active and completed
  const activeItems = filteredItems.filter((i) => !i.is_completed);
  const completedItems = filteredItems.filter((i) => i.is_completed);

  // Group active items by category key
  const categoriesMap: Record<string, typeof activeItems> = {};
  activeItems.forEach((item) => {
    const categoryKey = getCategoryKeyForItem(item.name, item.product_id);
    if (!categoriesMap[categoryKey]) {
      categoriesMap[categoryKey] = [];
    }
    categoriesMap[categoryKey].push(item);
  });

  const categories = Object.keys(categoriesMap);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      <Specular opacityClassName="via-white/20 dark:via-white/10" />

      {/* Checklist Header Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-heading font-black tracking-wider leading-none text-foreground uppercase">
            {t("title")}
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/50 border border-border/40 text-muted-foreground font-bold">
            {activeItems.length} {t("open")}
          </span>
        </div>

        {/* Local Search Input */}
        <div className="flex items-center gap-2 h-9 px-3 rounded-xl glass-inset select-none shrink-0 w-36 md:w-52">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none font-sans text-xs text-foreground placeholder:text-muted-foreground/40 min-w-0"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-none min-h-0">
        {/* Render grouped category items */}
        {categories.map((catKey) => (
          <div key={catKey} className="space-y-2">
            <div className="font-mono text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 select-none flex items-center gap-2">
              <span>{tCat(catKey)}</span>
              <div className="flex-1 h-[1px] bg-border/30" />
              <span className="text-[9px] text-muted-foreground/40">
                {categoriesMap[catKey].length}
              </span>
            </div>
            <div className="space-y-1.5">
              {categoriesMap[catKey].map((item) => (
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

        {/* Render completed items section at the bottom */}
        {completedItems.length > 0 && (
          <div className="pt-4 border-t border-border/30">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full font-mono text-[10px] font-bold text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest px-2 mb-2 select-none flex items-center justify-between cursor-pointer"
            >
              <span>
                {t("completed")} ({completedItems.length})
              </span>
              <span className="text-xs">
                {showCompleted ? `▲ ${t("hide")}` : `▼ ${t("show")}`}
              </span>
            </button>

            {showCompleted && (
              <div className="space-y-1.5 animate-in fade-in">
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
            )}
          </div>
        )}

        {/* Empty layout view */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 shrink-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center glass-inset text-muted-foreground/30">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest select-none">
              {t("empty")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
