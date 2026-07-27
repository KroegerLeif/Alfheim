"use client";

import { useTranslations } from "next-intl";
import { useSidebar } from "@/app/[locale]/providers";
import { useShoppingLists, useCreateShoppingList } from "@/features/shopping-lists/services/shoppingListService";
import { ChevronLeft, ShoppingCart, Plus, Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Sidebar navigation component for the Shopping App.
 * Displays active shopping lists with item counts and an inline list creator.
 * Uses design system glass tokens for surfaces; no hardcoded bg-white or static colors.
 */
export function Sidebar() {
  const t = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  // Fetch all shopping lists to show in the sidebar nav
  const { data: lists = [], isLoading } = useShoppingLists();

  // Inline new-list creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const createList = useCreateShoppingList();

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    createList.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
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

  if (!isSidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] flex flex-col h-full select-none font-mono relative shrink-0">

      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between gap-1">
        <div className="flex flex-col gap-1">
          <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none text-[var(--text-main)]">
            {t("title")}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">
            {t("subtitle")}
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1 rounded hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-colors"
          aria-label="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Section Label */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {t("lists")}
        </span>
      </div>

      {/* Lists Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-none space-y-1">
        {isLoading ? (
          // Skeleton shimmer placeholders
          <div className="space-y-1.5 animate-pulse px-2 pt-1">
            <div className="h-9 rounded-lg bg-[var(--surface-elevated)] opacity-40" />
            <div className="h-9 rounded-lg bg-[var(--surface-elevated)] opacity-30" />
            <div className="h-9 rounded-lg bg-[var(--surface-elevated)] opacity-20" />
          </div>
        ) : lists.length === 0 ? (
          <div className="px-2 py-6 text-center text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
            {t("noLists")}
          </div>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all duration-200 cursor-pointer group"
            >
              <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--primary-main)] transition-colors" />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider truncate text-[var(--text-main)]">
                {list.name}
              </span>
              {/* Item count badge */}
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)] leading-none">
                {list.items.length}
              </span>
            </div>
          ))
        )}
      </nav>

      {/* Inline List Creator */}
      <div className="p-3 border-t border-[var(--border-subtle)]">
        {isCreating ? (
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t("newListPlaceholder")}
              className="flex-1 bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider text-[var(--text-main)] placeholder:text-[var(--text-muted)] min-w-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newListName.trim() || createList.isPending}
              className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer disabled:opacity-40 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--primary-main)] hover:border-[var(--primary-main)] transition-all duration-200 cursor-pointer text-[10px] font-bold uppercase tracking-widest"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newList")}
          </button>
        )}
      </div>

      {/* Pantry Link Footer */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
        <div className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
          {t("pantry")}
        </div>
      </div>
    </aside>
  );
}
