"use client";

import { useTranslations } from "next-intl";
import { useSidebar, useActiveList } from "@/app/[locale]/providers";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  useHouseholds,
} from "@/features/shopping-lists/services/shoppingListService";
import { useKeycloakUser } from "@/lib/useKeycloakUser";
import {
  ChevronLeft,
  ShoppingCart,
  Plus,
  Check,
  X,
  Home,
  User,
  LogOut,
  Sparkles,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "@/features/shopping-lists/types";

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

/**
 * Sidepanel navigation featuring:
 * - Brand header
 * - Protected System Lists
 * - Drag-and-Drop reorderable Custom Lists
 * - User Profile Footer
 */
export function Sidebar() {
  const t = useTranslations("Navigation");
  const tChecklist = useTranslations("Checklist");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const { activeListId, setActiveListId } = useActiveList();
  const user = useKeycloakUser();

  const { data: listsData, isLoading } = useShoppingLists();
  const lists = listsData || [];
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();

  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggedListId, setDraggedListId] = useState<string | null>(null);

  useEffect(() => {
    setCustomOrder(getStoredOrder());
  }, []);

  const { data: households = [] } = useHouseholds();

  const isPersonalList = (l: ShoppingList) =>
    l.is_personal ||
    l.name === "NAVIGATION.PERSONAL_LIST" ||
    l.name === "NAVIGATION.PERSONAL_LISTS" ||
    l.name === "NAVIGATION.PERSONALLIST" ||
    l.name.includes("NAVIGATION.PERSONAL") ||
    l.name.includes("NAVIGATION.") ||
    l.name.endsWith(" - Liste") ||
    l.name.endsWith("'s List") ||
    l.name.startsWith("Lista ");

  const { householdLists, personalLists } = useMemo(() => {
    const hhLists: (ShoppingList & { displayName: string })[] = [];
    const persLists: ShoppingList[] = [];

    lists.forEach((list) => {
      if (list.is_default || list.name === "NAVIGATION.HOUSEHOLD_LISTS" || list.name === "NAVIGATION.HOUSEHOLDLISTS") {
        const hh = households.find((h) => h.id === list.home_id);
        hhLists.push({
          ...list,
          displayName: hh ? hh.name : (list.name.startsWith("NAVIGATION.") ? "Household List" : list.name),
        });
      } else {
        persLists.push(list);
      }
    });

    // Sort personal/custom lists: main personal list first, then custom lists by customOrder
    persLists.sort((a, b) => {
      const aIsPers = isPersonalList(a);
      const bIsPers = isPersonalList(b);
      if (aIsPers && !bIsPers) return -1;
      if (!aIsPers && bIsPers) return 1;
      
      const indexA = customOrder.indexOf(a.id);
      const indexB = customOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return { householdLists: hhLists, personalLists: persLists };
  }, [lists, households, customOrder]);

  const reorderableCustomLists = useMemo(() => {
    return personalLists.filter((l) => !isPersonalList(l));
  }, [personalLists]);

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

    const currentIds = reorderableCustomLists.map((l) => l.id);
    const fromIndex = currentIds.indexOf(draggedListId);
    const toIndex = currentIds.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...currentIds];
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
          setIsCreating(false);
          setNewListName("");
          setActiveListId(newList.id);
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
                const completedCount = list.items.filter((i) => i.is_completed).length;
                const totalCount = list.items.length;

                return (
                  <button
                    key={list.id}
                    onClick={() => handleSelectHouseholdList(list)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left group",
                      isActive
                        ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <Home
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-muted-foreground/60 group-hover:text-emerald-500"
                      )}
                    />

                    <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
                      {list.displayName}
                    </span>

                    <span
                      className={cn(
                        "font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border leading-none shrink-0 transition-colors",
                        isActive
                          ? "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20"
                          : "bg-muted/50 text-muted-foreground/60 border-border/40"
                      )}
                    >
                      {completedCount}/{totalCount}
                    </span>
                  </button>
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
                {personalLists.length}
              </span>
            </div>

            {personalLists.length === 0 && !isLoading && (
              <div className="px-3 py-3 text-center text-[11px] font-mono text-muted-foreground/40 italic">
                {t("noLists")}
              </div>
            )}

            {!isLoading && personalLists.map((list) => {
              const isActive = activeListId === list.id;
              const completedCount = list.items.filter((i) => i.is_completed).length;
              const totalCount = list.items.length;
              const isDragging = draggedListId === list.id;

              if (isPersonalList(list)) {
                return (
                  <button
                    key={list.id}
                    onClick={() => handleSelectPersonalOrCustomList(list)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left group",
                      isActive
                        ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <User
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-muted-foreground/60 group-hover:text-blue-500"
                      )}
                    />

                    <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
                      {user.username ? t("personalList", { username: user.username }) : (list.name.startsWith("NAVIGATION.") ? "Personal List" : list.name)}
                    </span>

                    <span
                      className={cn(
                        "font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border leading-none shrink-0 transition-colors",
                        isActive
                          ? "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20"
                          : "bg-muted/50 text-muted-foreground/60 border-border/40"
                      )}
                    >
                      {completedCount}/{totalCount}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={list.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, list.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, list.id)}
                  onDragEnd={() => setDraggedListId(null)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer group select-none",
                    isActive
                      ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    isDragging ? "opacity-30 scale-95 border-dashed border-blue-400" : ""
                  )}
                  onClick={() => handleSelectPersonalOrCustomList(list)}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />

                  <ShoppingCart
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary"
                    )}
                  />

                  <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
                    {list.name}
                  </span>

                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border leading-none shrink-0",
                      isActive
                        ? "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20"
                        : "bg-muted/50 text-muted-foreground/60 border-border/40"
                    )}
                  >
                    {completedCount}/{totalCount}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(tChecklist("deleteListConfirm", { name: list.name }))) {
                        deleteList.mutate(list.id, {
                          onSuccess: () => {
                            if (isActive) {
                              const fallback = householdLists[0] || personalLists[0];
                              if (fallback) {
                                setActiveListId(fallback.id);
                              }
                            }
                          },
                        });
                      }
                    }}
                    disabled={deleteList.isPending}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-opacity cursor-pointer"
                    title={tChecklist("deleteList")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            <div className="pt-2">
              {isCreating ? (
                <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border/60 glass-inset">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder={t("newListPlaceholder")}
                    className="flex-1 bg-transparent border-none outline-none text-xs font-heading font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/40 min-w-0"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") handleCancel();
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newListName.trim() || createList.isPending}
                    className="text-emerald-500 hover:text-emerald-400 p-1 cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="text-red-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-200 cursor-pointer text-xs font-heading font-bold uppercase tracking-wider"
                >
                  <Plus className="h-4 w-4" />
                  {t("newList")}
                </button>
              )}
            </div>
          </div>
        </div>


      </aside>
    </>
  );
}
