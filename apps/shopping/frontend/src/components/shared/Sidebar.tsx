"use client";

import { useTranslations } from "next-intl";
import { useSidebar } from "@/app/[locale]/providers";
import { ChevronLeft } from "lucide-react";

export function Sidebar() {
  const t = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  if (!isSidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-border bg-card text-card-foreground flex flex-col h-full select-none font-mono relative shrink-0">
      <div className="p-6 border-b border-border flex items-center justify-between gap-1">
        <div className="flex flex-col gap-1">
          <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none">
            {t("title")}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {t("subtitle")}
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 p-4">
        <p className="text-xs text-muted-foreground">Sidebar Navigation Placeholder</p>
      </div>
    </aside>
  );
}
