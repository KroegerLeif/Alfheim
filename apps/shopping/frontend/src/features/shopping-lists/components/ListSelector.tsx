"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
} from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface ListSelectorProps {
  activeListId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Tab switcher displaying active lists and counts, with inline create and delete options.
 */
export function ListSelector({ activeListId, onSelect }: ListSelectorProps) {
  const { data: lists = [], isLoading } = useShoppingLists();

  // Create list states
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    createList.mutate(
      { name: trimmed },
      {
        onSuccess: (newList) => {
          onSelect(newList.id);
          setIsCreating(false);
          setNewListName("");
        },
      }
    );
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewListName("");
  };

  if (isLoading) {
    return (
      <div className="flex gap-2 shrink-0">
        <div className="h-11 w-28 rounded-2xl glass-card animate-pulse" />
        <div className="h-11 w-28 rounded-2xl glass-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="shrink-0 max-w-full overflow-x-auto scrollbar-none flex items-center gap-2">
      <div className="inline-flex p-1.5 rounded-2xl glass-card relative overflow-hidden shrink-0 select-none">
        <Specular opacityClassName="via-white/30 dark:via-white/10" />

        <div className="flex gap-1 relative z-10 items-center">
          {lists.map((list) => {
            const isActive = activeListId === list.id;
            return (
              <div key={list.id} className="flex items-center gap-1">
                <button
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

                {isActive && lists.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete list "${list.name}"?`)) {
                        deleteList.mutate(list.id, {
                          onSuccess: () => {
                            const remaining = lists.filter((l) => l.id !== list.id);
                            if (remaining.length > 0) {
                              onSelect(remaining[0].id);
                            }
                          },
                        });
                      }
                    }}
                    disabled={deleteList.isPending}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-300 bg-[var(--surface-elevated)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer shrink-0"
                    title="Delete List"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Inline creation form */}
          {isCreating ? (
            <div className="flex items-center gap-1 px-2.5 h-9 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-subtle)] shrink-0">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Name..."
                className="bg-transparent border-none outline-none font-heading text-xs font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/40 w-24"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newListName.trim() || createList.isPending}
                className="text-green-500 hover:text-green-400 p-1 cursor-pointer disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCancel}
                className="text-red-500 hover:text-red-400 p-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground bg-[var(--surface-elevated)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer shrink-0"
              aria-label="Create List"
              title="Create List"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
