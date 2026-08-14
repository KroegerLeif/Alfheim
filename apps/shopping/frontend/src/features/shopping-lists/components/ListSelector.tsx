"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Check, X } from "lucide-react";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  useReorderShoppingLists,
  useHouseholds,
} from "../services/shoppingListService";
import { useKeycloakUser } from "@/lib/useKeycloakUser";
import type { ShoppingList } from "../types";
import { ListTab } from "./ListTab";

interface ListSelectorProps {
  activeListId: string | null;
  onSelect: (id: string) => void;
}

function isProtectedList(list: ShoppingList): boolean {
  return list.is_default || list.is_personal;
}

/**
 * Tab switcher displaying all visible shopping lists with drag-and-drop reordering and inline list actions.
 */
export function ListSelector({ activeListId, onSelect }: ListSelectorProps) {
  const tNav = useTranslations("Navigation");
  const { data: listsData, isLoading } = useShoppingLists();
  const lists = useMemo(() => listsData ?? [], [listsData]);

  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [draggedListId, setDraggedListId] = useState<string | null>(null);

  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const reorderLists = useReorderShoppingLists();
  const user = useKeycloakUser();
  const { data: householdsData } = useHouseholds();
  const households = useMemo(() => householdsData ?? [], [householdsData]);

  const isPersonalList = (l: ShoppingList) =>
    l.is_personal ||
    l.name.endsWith(" - Liste") ||
    l.name.endsWith("'s List") ||
    l.name.startsWith("Lista ");

  const { orderedLists, customListsOnly } = useMemo(() => {
    const hhLists: (ShoppingList & { displayName: string })[] = [];
    const persLists: ShoppingList[] = [];
    const custLists: ShoppingList[] = [];

    lists.forEach((list) => {
      if (list.is_default) {
        const hh = households.find((h) => h.id === list.home_id);
        hhLists.push({
          ...list,
          displayName: hh ? hh.name : tNav("household_list_fallback"),
        });
      } else {
        persLists.push(list);
        if (!list.is_personal) {
          custLists.push(list);
        }
      }
    });

    return {
      orderedLists: [...hhLists, ...persLists],
      customListsOnly: custLists,
    };
  }, [lists, households, tNav]);

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

    const customIds = customListsOnly.map((l) => l.id);
    const fromIndex = customIds.indexOf(draggedListId);
    const toIndex = customIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...customIds];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      reorderLists.mutate(updated);
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
        },
      }
    );
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewListName("");
  };

  const handleSelect = (list: ShoppingList) => {
    if (list.is_default || !list.is_personal) {
      localStorage.setItem("alfheim_active_household_id", list.home_id);
      window.dispatchEvent(new Event("storage-household-changed"));
    }
    onSelect(list.id);
  };

  if (isLoading) {
    return (
      <div className="flex gap-2 shrink-0">
        <div className="h-11 w-28 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="h-11 w-28 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
    );
  }

  const deletableCount = lists.filter((l) => !isProtectedList(l)).length;

  return (
    <div className="shrink-0 max-w-full overflow-x-auto scrollbar-none flex items-center gap-2">
      <div className="inline-flex p-1.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden shrink-0 select-none">
        <div className="flex gap-1 relative z-10 items-center">
          {orderedLists.map((list) => {
            const isActive = activeListId === list.id;
            const isProtected = isProtectedList(list);
            const canDelete = isActive && !isProtected && deletableCount > 0;
            const isDragging = draggedListId === list.id;

            return (
              <ListTab
                key={list.id}
                list={list}
                isActive={isActive}
                isProtected={isProtected}
                canDelete={canDelete}
                isDragging={isDragging}
                username={user.username}
                onSelect={() => handleSelect(list)}
                onDelete={() => {
                  deleteList.mutate(list.id, {
                    onSuccess: () => {
                      const remaining = lists.filter((l) => l.id !== list.id);
                      if (remaining.length > 0) {
                        const fallback = remaining[0];
                        handleSelect(fallback);
                      }
                    },
                  });
                }}
                onDragStart={(e) => handleDragStart(e, list.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, list.id)}
                onDragEnd={() => setDraggedListId(null)}
                isPersonalList={isPersonalList(list)}
                isPendingDelete={deleteList.isPending}
              />
            );
          })}

          {isCreating ? (
            <div className="flex items-center gap-1 px-2.5 h-9 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-subtle)] shrink-0">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder={tNav("newListPlaceholder")}
                className="bg-transparent border-none outline-none font-heading text-xs font-bold uppercase tracking-wider text-[var(--text-main)] placeholder:[var(--text-muted)] w-24"
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
              className="flex items-center justify-center w-9 h-9 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] transition-colors cursor-pointer shrink-0"
              title={tNav("newListPlaceholder")}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
