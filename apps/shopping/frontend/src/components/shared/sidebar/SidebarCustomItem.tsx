"use client";

import { GripVertical, ShoppingCart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface SidebarCustomItemProps {
  name: string;
  isActive: boolean;
  isDragging: boolean;
  completedCount: number;
  totalCount: number;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isPendingDelete?: boolean;
}

export function SidebarCustomItem({
  name,
  isActive,
  isDragging,
  completedCount,
  totalCount,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isPendingDelete = false,
}: SidebarCustomItemProps) {
  const tChecklist = useTranslations("Checklist");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer group select-none",
        isActive
          ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
        isDragging ? "opacity-30 scale-95 border-dashed border-blue-400" : ""
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />

      <ShoppingCart
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary"
        )}
      />

      <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
        {name}
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
          if (confirm(tChecklist("deleteListConfirm", { name }))) {
            onDelete();
          }
        }}
        disabled={isPendingDelete}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-opacity cursor-pointer disabled:opacity-40"
        title={tChecklist("deleteList")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
