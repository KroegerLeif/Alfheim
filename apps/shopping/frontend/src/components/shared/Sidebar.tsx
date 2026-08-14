"use client";

import { useTranslations } from "next-intl";
import { useSidebar, useActiveList } from "@/app/[locale]/providers";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  useReorderShoppingLists,
  useHouseholds,
} from "@/features/shopping-lists/services/shoppingListService";
import { useKeycloakUser } from "@/lib/useKeycloakUser";
import { ChevronLeft, Home, User, ShoppingBag } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "@/features/shopping-lists/types";
import { SidebarItem } from "./sidebar/SidebarItem";
import { SidebarCustomItem } from "./sidebar/SidebarCustomItem";
import { CreateListForm } from "./sidebar/CreateListForm";

/**
 * Clean Nordic Dark Sidebar navigation component for Shopping app.
 */
export function Sidebar() {
  const t = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const { activeListId, setActiveListId } = useActiveList();
  const user = useKeycloakUser();

  const { data: listsData, isLoading } = useShoppingLists();
  const lists = useMemo(() => listsData ?? [], [listsData]);
  
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const reorderLists = useReorderShoppingLists();

  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const { data: householdsData } = useHouseholds();
  const households = useMemo(() => householdsData ?? [], [householdsData]);

  const { householdLists, personalList, customLists } = useMemo(() => {
    const hhLists: (ShoppingList & { displayName: string })[] = [];
    let persList: ShoppingList | null = null;
    const custLists: ShoppingList[] = [];

    lists.forEach((list) => {
      if (list.is_default) {
        const hh = households.find((h) => h.id === list.home_id);
        hhLists.push({
          ...list,
          displayName: hh ? hh.name : t("household_list_fallback"),
        });
      } else if (list.is_personal) {
        persList = list;
      } else {
        custLists.push(list);
      }
    });

    return { householdLists: hhLists, personalList: persList, customLists: custLists };
  }, [lists, households, t]);

  const handleSelectHouseholdList = (list: ShoppingList) => {
    localStorage.setItem("alfheim_active_household_id", list.home_id);
    setActiveListId(list.id);
    window.dispatchEvent(new Event("storage-household-changed"));
  };

  const handleSelectPersonalOrCustomList = (list: ShoppingList) => {
    if (!list.is_personal) {
      localStorage.setItem("alfheim_active_household_id", list.home_id);
      window.dispatchEvent(new Event("storage-household-changed"));
    }
    setActiveListId(list.id);
  };

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

    const currentIds = customLists.map((l) => l.id);
    const fromIndex = currentIds.indexOf(draggedListId);
    const toIndex = currentIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...currentIds];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      reorderLists.mutate(updated);
    }
    setDraggedListId(null);
  };

  if (!isSidebarOpen) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "w-72 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] flex flex-col h-full select-none font-sans relative shrink-0 z-40 transition-colors duration-200 shadow-xl md:shadow-none",
          "fixed md:relative inset-y-0 left-0"
        )}
      >
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold uppercase tracking-wider text-[var(--text-main)] leading-tight">
                {t("title")}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-none">
                {t("subtitle")}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] cursor-pointer transition-colors"
            aria-label={t("collapseSidebar")}
            title={t("collapseSidebar")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-none">
          {/* Household Lists Section */}
          <div className="space-y-1">
            <div className="px-3 pb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t("household_lists")}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-2 px-2 animate-pulse">
                <div className="h-10 rounded-lg bg-[var(--surface-elevated)]" />
                <div className="h-10 rounded-lg bg-[var(--surface-elevated)]" />
              </div>
            ) : (
              householdLists.map((list) => {
                const isActive = activeListId === list.id;
                return (
                  <SidebarItem
                    key={list.id}
                    isActive={isActive}
                    onClick={() => handleSelectHouseholdList(list)}
                    icon={<Home className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-[var(--primary-main)]" : "text-[var(--text-muted)]")} />}
                    label={list.displayName}
                    completedCount={(list.items ?? []).filter((i) => i.is_completed).length}
                    totalCount={(list.items ?? []).length}
                  />
                );
              })
            )}
          </div>

          {/* Personal & Custom Lists Section */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t("personal_lists")}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {lists.filter(l => !l.is_default).length}
              </span>
            </div>

            {!isLoading && personalList && (
              <SidebarItem
                isActive={activeListId === (personalList as ShoppingList).id}
                onClick={() => handleSelectPersonalOrCustomList(personalList as ShoppingList)}
                icon={<User className={cn("h-4 w-4 shrink-0 transition-colors", activeListId === (personalList as ShoppingList).id ? "text-[var(--accent-cyan)]" : "text-[var(--text-muted)]")} />}
                label={user.username && user.username !== "User" ? t("personalList", { username: user.username }) : t("personal_list_fallback")}
                completedCount={((personalList as ShoppingList).items ?? []).filter((i) => i.is_completed).length}
                totalCount={((personalList as ShoppingList).items ?? []).length}
              />
            )}

            {!isLoading &&
              customLists.map((list) => (
                <SidebarCustomItem
                  key={list.id}
                  name={list.name}
                  isActive={activeListId === list.id}
                  isDragging={draggedListId === list.id}
                  completedCount={(list.items ?? []).filter((i) => i.is_completed).length}
                  totalCount={(list.items ?? []).length}
                  onSelect={() => handleSelectPersonalOrCustomList(list)}
                  onDelete={() => {
                    deleteList.mutate(list.id, {
                      onSuccess: () => {
                        if (activeListId === list.id) {
                          const fallback = householdLists[0] || personalList;
                          if (fallback) setActiveListId(fallback.id);
                        }
                      },
                    });
                  }}
                  onDragStart={(e) => handleDragStart(e, list.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, list.id)}
                  onDragEnd={() => setDraggedListId(null)}
                  isPendingDelete={deleteList.isPending}
                />
              ))}

            <CreateListForm onSave={(name) => createList.mutate({ name }, { onSuccess: (l) => setActiveListId(l.id) })} isPending={createList.isPending} />
          </div>
        </div>
      </aside>
    </>
  );
}
