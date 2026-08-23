"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  useShoppingLists, useCreateShoppingList, useDeleteShoppingList,
  useReorderShoppingLists, useHouseholds,
} from "../services/shoppingListService";
import { useKeycloakUser } from "@/lib/useKeycloakUser";
import type { ShoppingList } from "../types";
import { ListTab } from "./ListTab";
import { ListCreateForm } from "./ListCreateForm";

interface ListSelectorProps {
  activeListId: string | null;
  onSelect: (id: string) => void;
}

function isProtectedList(list: ShoppingList): boolean {
  return list.is_default || list.is_personal;
}

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
    l.is_personal || l.name.endsWith(" - Liste") || l.name.endsWith("'s List") || l.name.startsWith("Lista ");

  const { orderedLists, customListsOnly } = useMemo(() => {
    const hhLists: (ShoppingList & { displayName: string })[] = [];
    const persLists: ShoppingList[] = [];
    const custLists: ShoppingList[] = [];

    lists.forEach((list) => {
      if (list.is_default) {
        const hh = households.find((h) => h.id === list.home_id);
        hhLists.push({ ...list, displayName: hh ? hh.name : tNav("household_list_fallback") });
      } else {
        persLists.push(list);
        if (!list.is_personal) custLists.push(list);
      }
    });

    return { orderedLists: [...hhLists, ...persLists], customListsOnly: custLists };
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
    createList.mutate({ name: trimmed }, {
      onSuccess: (newList) => {
        onSelect(newList.id);
        setIsCreating(false);
        setNewListName("");
      },
    });
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
                key={list.id} list={list} isActive={isActive} isProtected={isProtected}
                canDelete={canDelete} isDragging={isDragging} username={user.username}
                onSelect={() => handleSelect(list)}
                onDelete={() => {
                  deleteList.mutate(list.id, {
                    onSuccess: () => {
                      const remaining = lists.filter((l) => l.id !== list.id);
                      if (remaining.length > 0) handleSelect(remaining[0]);
                    },
                  });
                }}
                onDragStart={(e) => handleDragStart(e, list.id)}
                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, list.id)}
                onDragEnd={() => setDraggedListId(null)} isPersonalList={isPersonalList(list)}
                isPendingDelete={deleteList.isPending}
              />
            );
          })}

          {isCreating ? (
            <ListCreateForm
              newListName={newListName} setNewListName={setNewListName}
              onCreate={handleCreate} onCancel={handleCancel} isPending={createList.isPending}
            />
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
