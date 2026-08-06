"use client";

import { useTranslations } from "next-intl";
import { User, Home, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShoppingList } from "../types";

interface ListTabProps {
  list: ShoppingList & { displayName?: string };
  isActive: boolean;
  isProtected: boolean;
  canDelete: boolean;
  isDragging: boolean;
  username: string | undefined;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isPersonalList: boolean;
  isPendingDelete?: boolean;
}

export function ListTab({
  list,
  isActive,
  isProtected,
  canDelete,
  isDragging,
  username,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isPersonalList,
  isPendingDelete = false,
}: ListTabProps) {
  const tNav = useTranslations("Navigation");
  const tChecklist = useTranslations("Checklist");

  return (
    <div
      draggable={!isProtected}
      onDragStart={(e) => !isProtected && onDragStart(e)}
      onDragOver={(e) => !isProtected && onDragOver(e)}
      onDrop={(e) => !isProtected && onDrop(e)}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-1 transition-all duration-200",
        isDragging ? "opacity-30 scale-95" : ""
      )}
    >
      <button
        onClick={onSelect}
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

        {isPersonalList && (
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

        <span>
          {isPersonalList
            ? (username && username !== "User"
                ? tNav("personalList", { username })
                : tNav("personal_list_fallback"))
            : list.is_default
            ? list.displayName || tNav("household_list_fallback")
            : list.name}
        </span>

        <span
          className={cn(
            "font-mono text-[10px] font-bold leading-none px-1 py-0.5 rounded",
            isActive
              ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
              : "bg-white/5 text-muted-foreground/50"
          )}
        >
          {(list.items ?? []).length}
        </span>
      </button>

      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(tChecklist("deleteListConfirm", { name: list.name }))) {
              onDelete();
            }
          }}
          disabled={isPendingDelete}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-300 bg-[var(--surface-elevated)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer shrink-0 disabled:opacity-40"
          title={tChecklist("deleteList")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
