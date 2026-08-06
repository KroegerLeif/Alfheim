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
import { ChevronLeft, Home, User, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "@/features/shopping-lists/types";
import { SidebarItem } from "./sidebar/SidebarItem";
import { SidebarCustomItem } from "./sidebar/SidebarCustomItem";
import { CreateListForm } from "./sidebar/CreateListForm";

/**
 * Sidepanel navigation featuring:
 * - Brand header
 * - Protected System Lists
 * - Drag-and-Drop reorderable Custom Lists via backend position indexes
 * - User Profile Footer
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
    localStorage.setItem("loeger_os_active_household_id", list.home_id);
    setActiveListId(list.id);
    window.dispatchEvent(new Event("storage-household-changed"));
  };

  const handleSelectPersonalOrCustomList = (list: ShoppingList) => {
    if (!list.is_personal) {
      localStorage.setItem("loeger_os_active_household_id", list.home_id);
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

      // Save order changes directly to the database
      reorderLists.mutate(updated);
    }
    setDraggedListId(null);
  };

  const handleCreate = (name: string) => {
    createList.mutate(
      { name },
      {
        onSuccess: (newList) => {
          setActiveListId(newList.id);
        },
      }
    );
  };

  if (!isSidebarOpen) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "w-72 border-r border-border/40 bg-card/95 backdrop-blur-xl text-foreground flex flex-col h-full select-none font-sans relative shrink-0 z-50 transition-all duration-300 shadow-xl md:shadow-none",
          "fixed md:relative inset-y-0 left-0"
        )}
      >
        <div className="p-5 border-b border-border/40 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-black uppercase tracking-wider text-foreground leading-tight">
                {t("title")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest leading-none">
                {t("subtitle")}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/50">
                {t("household_lists")}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-2 px-2 animate-pulse">
                <div className="h-10 rounded-xl bg-muted/40" />
                <div className="h-10 rounded-xl bg-muted/30" />
              </div>
            ) : (
              householdLists.map((list) => {
                const isActive = activeListId === list.id;
                const completedCount = (list.items ?? []).filter((i) => i.is_completed).length;
                const totalCount = (list.items ?? []).length;

                return (
                  <SidebarItem
                    key={list.id}
                    isActive={isActive}
                    onClick={() => handleSelectHouseholdList(list)}
                    icon={
                      <Home
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-muted-foreground/60 group-hover:text-emerald-500"
                        )}
                      />
                    }
                    label={list.displayName}
                    completedCount={completedCount}
                    totalCount={totalCount}
                  />
                );
              })
            )}
          </div>

          {/* Personal & Custom Lists Section */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/50">
                {t("personal_lists")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {lists.filter(l => !l.is_default).length}
              </span>
            </div>

            {lists.length === 0 && !isLoading && (
              <div className="px-3 py-3 text-center text-[11px] font-mono text-muted-foreground/40 italic">
                {t("noLists")}
              </div>
            )}

            {!isLoading && personalList && (
              <SidebarItem
                isActive={activeListId === (personalList as ShoppingList).id}
                onClick={() => handleSelectPersonalOrCustomList(personalList as ShoppingList)}
                icon={
                  <User
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      activeListId === (personalList as ShoppingList).id
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-muted-foreground/60 group-hover:text-blue-500"
                    )}
                  />
                }
                label={
                  user.username && user.username !== "User"
                    ? t("personalList", { username: user.username })
                    : t("personal_list_fallback")
                }
                completedCount={((personalList as ShoppingList).items ?? []).filter((i) => i.is_completed).length}
                totalCount={((personalList as ShoppingList).items ?? []).length}
              />
            )}

            {!isLoading &&
              customLists.map((list) => {
                const isActive = activeListId === list.id;
                const completedCount = (list.items ?? []).filter((i) => i.is_completed).length;
                const totalCount = (list.items ?? []).length;
                const isDragging = draggedListId === list.id;

                return (
                  <SidebarCustomItem
                    key={list.id}
                    name={list.name}
                    isActive={isActive}
                    isDragging={isDragging}
                    completedCount={completedCount}
                    totalCount={totalCount}
                    onSelect={() => handleSelectPersonalOrCustomList(list)}
                    onDelete={() => {
                      deleteList.mutate(list.id, {
                        onSuccess: () => {
                          if (isActive) {
                            const fallback = householdLists[0] || personalList;
                            if (fallback) {
                              setActiveListId(fallback.id);
                            }
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
                );
              })}

            <CreateListForm onSave={handleCreate} isPending={createList.isPending} />
          </div>
        </div>
      </aside>
    </>
  );
}
