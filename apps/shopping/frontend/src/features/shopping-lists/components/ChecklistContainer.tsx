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
import { getCategoryKeyForItem } from "../utils/category";

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
  const { data: list, isLoading, isError } = useShoppingListDetails(listId);
  const toggleItem = useUpdateShoppingItem(listId);
  const deleteItem = useDeleteShoppingItem(listId);

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="p-4 border border-rose-800/40 bg-rose-950/20 text-rose-400 font-mono text-xs font-bold uppercase rounded-lg">
          Failed to load shopping list details.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 animate-pulse">
        <div className="h-6 w-32 bg-[var(--surface-elevated)] rounded-md" />
        <div className="h-4 w-48 bg-[var(--surface-elevated)] rounded-md" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 shrink-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
            <ShoppingCart className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest select-none">
            {t("empty")}
          </span>
        </div>
      </div>
    );
  }

  const items = list?.items ?? [];

  // Filter items by search query
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openItems = filtered.filter((i) => !i.is_completed);
  const completedItems = filtered.filter((i) => i.is_completed);

  // Group open items by derived Category
  const categoriesMap: Record<string, typeof items> = {};
  openItems.forEach((item) => {
    const key = getCategoryKeyForItem(item.name);
    if (!categoriesMap[key]) categoriesMap[key] = [];
    categoriesMap[key].push(item);
  });

  const categoryKeys = Object.keys(categoriesMap);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      {/* Search and item count filter sub-header */}
      <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none font-heading text-xs font-semibold text-[var(--text-main)] placeholder:[var(--text-muted)]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--text-muted)] shrink-0 select-none">
          <span className="text-[var(--primary-main)]">{openItems.length}</span> {t("open")}
          <span>•</span>
          <span className="text-[var(--text-muted)]">{completedItems.length}</span> {t("completed")}
        </div>
      </div>

      {/* Main checklist container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-none min-h-0">
        {/* Render grouped open items by category */}
        {categoryKeys.map((catKey) => (
          <div key={catKey} className="space-y-2">
            <div className="px-2">
              <span className="font-mono text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                {tCat(catKey)}
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
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full font-mono text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] uppercase tracking-widest px-2 mb-2 select-none flex items-center justify-between cursor-pointer"
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
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-widest select-none">
              {t("empty")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
