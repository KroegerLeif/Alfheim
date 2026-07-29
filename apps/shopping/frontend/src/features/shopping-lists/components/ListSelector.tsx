"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, X, Home, User, GripVertical } from "lucide-react";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
} from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "../types";

interface ListSelectorProps {
  activeListId: string | null;
  onSelect: (id: string) => void;
}

const DND_STORAGE_KEY = "loeger_os_shopping_list_order";

function getStoredOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DND_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredOrder(order: string[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(DND_STORAGE_KEY, JSON.stringify(order));
  }
}

function isProtectedList(list: ShoppingList): boolean {
  return list.is_default || list.is_personal;
}

/**
 * Tab switcher displaying all visible shopping lists with drag-and-drop reordering and inline list actions.
 */
export function ListSelector({ activeListId, onSelect }: ListSelectorProps) {
  const { data: lists = [], isLoading } = useShoppingLists();

  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggedListId, setDraggedListId] = useState<string | null>(null);

  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();

  useEffect(() => {
    setCustomOrder(getStoredOrder());
  }, []);

  const orderedLists = useMemo(() => {
    const protectedLists = lists.filter(isProtectedList);
    const customLists = lists.filter((l) => !isProtectedList(l));

    protectedLists.sort((a, b) => (a.is_default ? -1 : b.is_default ? 1 : 0));

    if (customOrder.length > 0) {
      customLists.sort((a, b) => {
        const indexA = customOrder.indexOf(a.id);
        const indexB = customOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return [...protectedLists, ...customLists];
  }, [lists, customOrder]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedListId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedListId || draggedListId === targetId) return;

    const customIds = orderedLists.filter((l) => !isProtectedList(l)).map((l) => l.id);
    const fromIndex = customIds.indexOf(draggedListId);
    const toIndex = customIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...customIds];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      setCustomOrder(updated);
      setStoredOrder(updated);
    }
    setDraggedListId(null);
  };

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
          const updated = [...customOrder, newList.id];
          setCustomOrder(updated);
          setStoredOrder(updated);
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

  const deletableCount = lists.filter((l) => !isProtectedList(l)).length;

  return (
    <div className="shrink-0 max-w-full overflow-x-auto scrollbar-none flex items-center gap-2">
      <div className="inline-flex p-1.5 rounded-2xl glass-card relative overflow-hidden shrink-0 select-none">
        <Specular opacityClassName="via-white/30 dark:via-white/10" />

        <div className="flex gap-1 relative z-10 items-center">
          {orderedLists.map((list) => {
            const isActive = activeListId === list.id;
            const isProtected = isProtectedList(list);
            const canDelete = isActive && !isProtected && deletableCount > 0;
            const isDragging = draggedListId === list.id;

            return (
              <div
                key={list.id}
                draggable={!isProtected}
                onDragStart={(e) => !isProtected && handleDragStart(e, list.id)}
                onDragOver={(e) => !isProtected && handleDragOver(e)}
                onDrop={(e) => !isProtected && handleDrop(e, list.id)}
                onDragEnd={() => setDraggedListId(null)}
                className={cn(
                  "flex items-center gap-1 transition-all duration-200",
                  isDragging ? "opacity-30 scale-95" : ""
                )}
              >
                <button
                  onClick={() => onSelect(list.id)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3.5 rounded-xl cursor-pointer transition-all duration-300 font-heading text-xs font-extrabold uppercase tracking-wider outline-none group",
                    isActive
                      ? "glass-active text-foreground font-black"
                      : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {!isProtected && (
                    <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab shrink-0 -ml-1" />
                  )}

                  {list.is_personal && (
                    <User
                      className={cn(
                        "h-3 w-3 shrink-0",
                        isActive ? "text-blue-400" : "text-muted-foreground/40"
                      )}
                    />
                  )}
                  {list.is_default && (
                    <Home
                      className={cn(
                        "h-3 w-3 shrink-0",
                        isActive ? "text-emerald-400" : "text-muted-foreground/40"
                      )}
                    />
                  )}

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

                {canDelete && (
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
