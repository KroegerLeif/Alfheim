"use client";

import { useTranslations } from "next-intl";
import { useSidebar, useActiveList } from "@/app/[locale]/providers";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
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
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "@/features/shopping-lists/types";

/**
 * Optimized sidepanel navigation inspired by Figma Export & Stitch Layouts.
 * Features:
 * - Brand header (loeger-os / Shopping List Management)
 * - Protected System Lists (Household & Personal User List) pinned at top
 * - Custom Lists section with inline creator & badge counts
 * - User Profile & Account section at bottom with Keycloak Logout CTA
 * - Desktop persistent/collapsible drawer & Mobile overlay sheet with backdrop blur
 */
export function Sidebar() {
  const t = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const { activeListId, setActiveListId } = useActiveList();
  const user = useKeycloakUser();

  // Shopping lists queries & mutations
  const { data: lists = [], isLoading } = useShoppingLists();
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();

  // Inline creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Categorize system lists vs custom lists
  const { systemLists, customLists } = useMemo(() => {
    const system: ShoppingList[] = [];
    const custom: ShoppingList[] = [];

    lists.forEach((list) => {
      if (list.is_default || list.is_personal) {
        system.push(list);
      } else {
        custom.push(list);
      }
    });

    // Ensure Household is first, then Personal
    system.sort((a, b) => (a.is_default ? -1 : b.is_default ? 1 : 0));

    return { systemLists: system, customLists: custom };
  }, [lists]);

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
      {/* Mobile Backdrop Overlay */}
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
        {/* Brand Header */}
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
            aria-label="Collapse Sidebar"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-none">
          {/* Section 1: System Lists (Household & Personal) */}
          <div className="space-y-1">
            <div className="px-3 pb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/50">
                {t("systemLists")}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-2 px-2 animate-pulse">
                <div className="h-10 rounded-xl bg-muted/40" />
                <div className="h-10 rounded-xl bg-muted/30" />
              </div>
            ) : (
              systemLists.map((list) => {
                const isActive = activeListId === list.id;
                const completedCount = list.items.filter(
                  (i) => i.is_completed
                ).length;
                const totalCount = list.items.length;

                return (
                  <button
                    key={list.id}
                    onClick={() => setActiveListId(list.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left group",
                      isActive
                        ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {list.is_default ? (
                      <Home
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-muted-foreground/60 group-hover:text-emerald-500"
                        )}
                      />
                    ) : (
                      <User
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-muted-foreground/60 group-hover:text-blue-500"
                        )}
                      />
                    )}

                    <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
                      {list.is_personal && user.username
                        ? `${user.username} - Liste`
                        : list.name}
                    </span>

                    {/* Item count badge (completed / total) */}
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

          {/* Section 2: Custom Lists */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/50">
                {t("customLists")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {customLists.length}
              </span>
            </div>

            {customLists.length === 0 && !isLoading && (
              <div className="px-3 py-3 text-center text-[11px] font-mono text-muted-foreground/40 italic">
                {t("noLists")}
              </div>
            )}

            {customLists.map((list) => {
              const isActive = activeListId === list.id;
              const completedCount = list.items.filter(
                (i) => i.is_completed
              ).length;
              const totalCount = list.items.length;

              return (
                <div
                  key={list.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 cursor-pointer group",
                    isActive
                      ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                  onClick={() => setActiveListId(list.id)}
                >
                  <ShoppingCart
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground/60 group-hover:text-primary"
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

                  {/* Delete button for custom list */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete custom list "${list.name}"?`)) {
                        deleteList.mutate(list.id, {
                          onSuccess: () => {
                            if (isActive && systemLists.length > 0) {
                              setActiveListId(systemLists[0].id);
                            }
                          },
                        });
                      }
                    }}
                    disabled={deleteList.isPending}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-opacity cursor-pointer"
                    title="Delete List"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Inline List Creator */}
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

        {/* User Profile & Account Footer Section */}
        <div className="p-3 border-t border-border/40 bg-card/60 shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl glass-inset">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Avatar Badge */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white font-mono text-xs font-black shrink-0 border border-white/20 shadow-xs">
                {user.avatarInitials}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-heading font-black uppercase tracking-wider text-foreground truncate">
                  {user.name}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
                  @{user.username}
                </span>
              </div>
            </div>

            {/* Logout CTA Button */}
            <button
              onClick={user.logout}
              className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-colors shrink-0"
              aria-label={t("logout")}
              title={t("logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
