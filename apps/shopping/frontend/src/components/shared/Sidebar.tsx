"use client";

import { useTranslations } from "next-intl";

export function Sidebar() {
  const t = useTranslations("Navigation");
  return (
    <aside className="w-64 border-r border-border bg-card text-card-foreground flex flex-col h-full select-none font-mono">
      <div className="p-6 border-b border-border flex flex-col gap-1">
        <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none">
          {t("title")}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
          {t("subtitle")}
        </div>
      </div>
      <div className="flex-1 p-4">
        <p className="text-xs text-muted-foreground">Sidebar Navigation Placeholder</p>
      </div>
    </aside>
  );
}
