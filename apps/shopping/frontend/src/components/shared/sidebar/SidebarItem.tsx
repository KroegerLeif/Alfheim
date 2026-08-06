"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  completedCount: number;
  totalCount: number;
}

export function SidebarItem({
  isActive,
  onClick,
  icon,
  label,
  completedCount,
  totalCount,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-left group",
        isActive
          ? "glass-active border-blue-500/30 text-foreground font-bold shadow-xs"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {icon}

      <span className="flex-1 text-xs font-heading font-extrabold uppercase tracking-wider truncate">
        {label}
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
